class Part {
	parent: Part|null = null;
	device: Device;
	field: Field;
	charges: Part[];
	chargeArrangement: ChargeArrangement;
	chargeCountByRow: number[];
	division: Division;
	parts: Part[];

	public constructor(part: Partial<Part>) {
		this.parent = part.parent ?? null;
		this.device = part.device ?? DEVICE.get(DeviceId.heater)!;
		this.field = part.field ?? Field.createPlain();
		this.charges = part.charges ?? [];
		this.chargeArrangement = part.chargeArrangement ?? ChargeArrangement.unspecified;
		this.chargeCountByRow = part.chargeCountByRow ?? [];
		this.division = part.division ?? Division.none;
		this.parts = part.parts ?? [];
	}

	public clone(): Part {
		let part = new Part(this);
		part.field = this.field.clone();
		part.charges = this.charges.map(c => c.clone());
		part.chargeCountByRow = [...this.chargeCountByRow];
		part.parts = this.parts.map(p => p.clone());
		return part;
	}

	public equals(other: Part): boolean {
		let childEquivalences = [[this.charges,other.charges], [this.parts,other.parts]].map(pair => {
			return !pair[0].some((part,i) => !part.equals(pair[1][i]));
		});
		return childEquivalences[0] && childEquivalences[1] && this.chargeArrangement == other.chargeArrangement &&
			this.device == other.device && this.field.equals(other.field) &&
			this.chargeCountByRow.join() == other.chargeCountByRow.join()
		;
	}

	public addCharge(part: Part) {
		if([DeviceType.escutcheon, DeviceType.subdivision].includes(part.device.type)) {
			return;
		}
		this.charges.push(part);
		part.parent = this;
	}

	public divide(div: Division): void {
		this.division = div;
		if(div == Division.none) {
			let firstSub = this.parts[0];
			this.parts = [];
			if(firstSub) {
				this.charges = firstSub.charges;
				this.chargeArrangement = firstSub.chargeArrangement;
				this.chargeCountByRow = firstSub.chargeCountByRow;
				this.division = firstSub.division;
				this.parts = firstSub.parts;
				[...this.parts, ...this.charges].forEach(p => p.parent = this);
			}
			return;
		}
		let arr = [0,0];
		if(div == Division.quarterly || div == Division.saltire) {
			arr.push(0,0);
		}
		this.parts = arr.map(_ => new Part({
			parent: this,
			device: DEVICE.get(DeviceId.sub)!,
			chargeArrangement: this.chargeArrangement,
			chargeCountByRow: this.chargeCountByRow,
		}));
		this.parts[0].field = this.field;
		this.parts[0].charges = this.charges;
		this.charges.forEach(c => c.parent = this.parts[0]);
		this.charges = [];
	}
}

enum Division {
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
	tincture: Tincture;
	tinctureSecondary: Tincture;
	number: number;

	public static createPlain(tincture: Tincture|null=null): Field {
		let field = new Field();
		field.variation = FieldVariation.plain;
		field.tincture = tincture ?? Tincture.argent;
		field.tinctureSecondary = Tincture.argent;
		field.number = 8;
		return field;
	}

	public clone(): Field {
		let field = new Field();
		field.variation = this.variation;
		field.tincture = this.tincture;
		field.tinctureSecondary = this.tinctureSecondary;
		field.number = this.number;
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
	bend, bendSinister, fess, pale, chevron, chevronReversed, chief, canton, cross, saltire,
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
		{ id: DeviceId.canton, type: DeviceType.ordinary },
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