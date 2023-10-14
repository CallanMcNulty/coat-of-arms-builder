class Part {
	parent: Part|null = null;
	device: Device;
	field: Field;
	charges: Part[];
	chargeArrangement: ChargeArrangement;
	chargeCountByRow: number[];
	division: Division;
	parts: Part[];
	line: DivisionLine;
	chargeDegree: number;

	public constructor(part: Partial<Part>) {
		this.parent = part.parent ?? null;
		this.device = part.device ?? DEVICE.get(DeviceId.heater)!;
		this.field = part.field ?? Field.createPlain();
		this.charges = part.charges ?? [];
		this.charges.forEach(c => c.parent = this);
		this.chargeArrangement = part.chargeArrangement ?? ChargeArrangement.unspecified;
		this.chargeCountByRow = part.chargeCountByRow ?? [this.charges.length];
		this.division = part.division ?? new Division(DivisionType.none, DivisionLine.straight);
		this.parts = part.parts ?? [];
		this.line = part.line ?? DivisionLine.straight;
		this.chargeDegree = part.chargeDegree ?? (this.device.id == DeviceId.mullet ? 5 : 1);
	}

	public clone(): Part {
		let part = new Part(this);
		part.field = this.field.clone();
		part.charges = this.charges.map(c => c.clone());
		part.chargeCountByRow = [...this.chargeCountByRow];
		part.parts = this.parts.map(p => p.clone());
		part.division = this.division.clone();
		return part;
	}

	public equals(other: Part): boolean {
		let childEquivalences = [[this.charges,other.charges], [this.parts,other.parts]].map(pair => {
			if(pair[0].length != pair[1].length) {
				return false;
			}
			return !pair[0].some((part,i) => !part.equals(pair[1][i]));
		});
		return childEquivalences[0] && childEquivalences[1] && this.chargeArrangement == other.chargeArrangement &&
			this.device == other.device && this.field.equals(other.field) &&
			this.chargeCountByRow.join() == other.chargeCountByRow.join()
		;
	}

	public addCharge(part: Part) {
		if(
			[DeviceType.escutcheon, DeviceType.subdivision].includes(part.device.type) &&
			(DeviceType.ordinary == part.device.type && this.charges.some(c => c.device.id == part.device.id))
		) {
			return;
		}
		this.charges.push(part);
		part.parent = this;
	}

	public updateChargeArrangement(chargeArrangement: ChargeArrangement, chargeCountByRow: number[]=[]) {
		this.chargeArrangement = chargeArrangement;
		let covered = 0;
		let counts = [];
		for(let count of chargeCountByRow) {
			let needed = this.charges.length - covered;
			if(count >= needed) {
				covered += needed;
				counts.push(needed);
				break;
			} else {
				covered += count;
				counts.push(count);
			}
		}
		let needed = this.charges.length - covered;
		if(needed > 0) {
			counts.push(needed);
		}
		this.chargeCountByRow = counts;
	}

	public divide(div: Division): void {
		if(div.type == DivisionType.none) {
			let firstSub = this.parts[0];
			if(firstSub) {
				this.charges = firstSub.charges;
				this.chargeArrangement = firstSub.chargeArrangement;
				this.chargeCountByRow = firstSub.chargeCountByRow;
				this.charges.forEach(p => p.parent = this);
				this.field = firstSub.field;
				this.division = firstSub.division;
				this.parts = firstSub.parts;
				this.line = firstSub.line;
				this.chargeDegree = firstSub.chargeDegree;
			}
			return;
		}
		let desiredPartCount = 2;
		if(div.type == DivisionType.quarterly || div.type == DivisionType.saltire) {
			desiredPartCount = 4;
		}
		while(this.parts.length < desiredPartCount) {
			let newPart = new Part(this.parts.length ? {} : this.clone());
			newPart.parent = this;
			newPart.device = DEVICE.get(DeviceId.sub)!;
			this.parts.push(newPart);
		}
		this.division = div;
		this.charges = [];
	}
}

enum DivisionType {
	none,
	pale,
	fess,
	bend,
	bendSinister,
	chevron,
	chevronReversed,
	quarterly,
	saltire,
}

enum DivisionLine {
	straight,
	indented,
	wavy,
	embattled,
	engrailed,
	invected,
}

class Division {
	type: DivisionType;
	line: DivisionLine;

	public constructor(type: DivisionType, line: DivisionLine) {
		this.type = type;
		this.line = line;
	}

	public equals(other: Division): boolean {
		return this.type == other.type && this.line == other.line;
	}

	public clone(): Division {
		return new Division(this.type, this.line);
	}
}

enum ChargeArrangement {
	unspecified,
	specified,
	bendwise,
	bendwiseSinister,
	chevronwise,
	chevronwiseReversed,
	crosswise,
	fesswise,
	palewise,
	saltirewise,
}

class Field {
	variation: FieldVariation;
	variationLine: DivisionLine;
	tincture: Tincture;
	tinctureSecondary: Tincture;
	number: number;

	public static createPlain(tincture: Tincture|null=null): Field {
		let field = new Field();
		field.variation = FieldVariation.plain;
		field.tincture = tincture ?? Tincture.argent;
		field.tinctureSecondary = Tincture.argent;
		field.number = 8;
		field.variationLine = DivisionLine.straight;
		return field;
	}

	public clone(): Field {
		let field = new Field();
		field.variation = this.variation;
		field.tincture = this.tincture;
		field.tinctureSecondary = this.tinctureSecondary;
		field.number = this.number;
		field.variationLine = this.variationLine;
		return field;
	}

	public equals(other: Field): boolean {
		return this.variation == other.variation && this.number == other.number &&
			this.tincture == other.tincture && this.tinctureSecondary == other.tinctureSecondary
		;
	}
}

enum FieldVariation {
	plain,
	barry,
	paly,
	bendy,
	bendySinister,
	chequy,
	lozengy,
}

enum Tincture {
	or,
	argent,
	azure,
	gules,
	sable,
	vert,
	purpure,
	ermine,
	vair,
}

class Device {
	id: DeviceId;
	type: DeviceType;
}

enum DeviceType {
	escutcheon,
	mobileCharge,
	beast,
	ordinary,
	subdivision,
}

enum DeviceId {
	heater,
	sub,
	bend, bendSinister, fess, pale, chevron, chevronReversed, canton, quarter, chief, base, cross, saltire,
	roundel, lozenge, mullet, heart,
}

const DEVICE: Map<DeviceId, Device> = (() => {
	let map = new Map();
	let devices: Device[] = [
		{ id: DeviceId.heater, type: DeviceType.escutcheon },

		{ id: DeviceId.sub, type: DeviceType.subdivision },

		{ id: DeviceId.bend, type: DeviceType.ordinary },
		{ id: DeviceId.bendSinister, type: DeviceType.ordinary },
		{ id: DeviceId.fess, type: DeviceType.ordinary },
		{ id: DeviceId.pale, type: DeviceType.ordinary },
		{ id: DeviceId.chevron, type: DeviceType.ordinary },
		{ id: DeviceId.chevronReversed, type: DeviceType.ordinary },
		{ id: DeviceId.chief, type: DeviceType.ordinary },
		{ id: DeviceId.base, type: DeviceType.ordinary },
		{ id: DeviceId.canton, type: DeviceType.ordinary },
		{ id: DeviceId.quarter, type: DeviceType.ordinary },
		{ id: DeviceId.cross, type: DeviceType.ordinary },
		{ id: DeviceId.saltire, type: DeviceType.ordinary },

		{ id: DeviceId.roundel, type: DeviceType.mobileCharge },
		{ id: DeviceId.lozenge, type: DeviceType.mobileCharge },
		{ id: DeviceId.mullet, type: DeviceType.mobileCharge },
		{ id: DeviceId.heart, type: DeviceType.mobileCharge },
	];
	for(let device of devices) {
		map.set(device.id, device);
	}
	return map;
})();