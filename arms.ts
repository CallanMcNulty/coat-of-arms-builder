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
		this.apply(part);
	}

	private apply(part: Partial<Part>) {
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

	public randomize(degree: number) {
		let complexity = degree;
		let disallowedTinctures: Tincture[] = [];
		if(this.parent) {
			disallowedTinctures = [this.parent, ...this.parent.parts, ...this.parent.charges].flatMap(p => {
				let tinctures = [p.field.tincture];
				if(p.field.variation != FieldVariation.plain) {
					tinctures.push(p.field.tinctureSecondary);
				}
				return tinctures;
			});
		}
		let baseTinctures = shuffleArray([
			Tincture.or, Tincture.argent, Tincture.azure, Tincture.gules, Tincture.sable, Tincture.vert, Tincture.purpure
		]).filter(t => !disallowedTinctures.includes(t));
		let field = Field.createPlain(baseTinctures.pop());
		this.apply({field:field, parent:this.parent, device:this.device});
		if(complexity <= 0) {
			return;
		}
		let features = [
			{ feature: 'charge', cost:1, subFeatures:[
				{ feature: 'ordinary', cost:1, subFeatures:[
					{ feature: 'ordinaryWithLine', cost:1, subFeatures:[] },
					{ feature: 'complexOrdinary', cost:3, subFeatures:[] },
				]},
				{ feature: 'multiCharge', cost:1, subFeatures:[] },
				{ feature: 'complexMobileCharge', cost:2, subFeatures:[] },
			]},
			{ feature: 'field', cost:1, subFeatures:[
				{ feature: 'fur', cost:2, subFeatures:[] },
				{ feature: 'fieldVariation', cost:1, subFeatures:[
					{ feature: 'fieldVariationWithLine', cost:1, subFeatures:[] },
					{ feature: 'complexFieldVariation', cost:2, subFeatures:[] },
				]},
			]},
			{ feature: 'division', cost:2, subFeatures:[
				{ feature: 'divisionWithLine', cost:1, subFeatures:[] },
				{ feature: '4PartDivision', cost:3, subFeatures:[] },
			]},
		];
		let selectedFeatures: string[] = [];
		while(complexity && selectedFeatures.length < 4) {
			features.filter(f => f.cost < complexity);
			features = shuffleArray(features);
			let selected = features.pop()!;
			complexity -= selected.cost;
			if(selected.subFeatures.length) {
				features.push(randomFromArray(selected.subFeatures));
			}
			selectedFeatures.push(selected.feature);
		}
		if(selectedFeatures.includes('field')) {
			if(selectedFeatures.includes('fur')) {
				this.field.tincture = randomFromArray([Tincture.ermine, Tincture.vair]);
			} else if(selectedFeatures.includes('fieldVariation')) {
				let variation: FieldVariation;
				if(selectedFeatures.includes('complexFieldVariation')) {
					variation = randomFromArray([FieldVariation.chequy, FieldVariation.lozengy]);
				} else {
					variation = randomFromArray([
						FieldVariation.barry, FieldVariation.paly, FieldVariation.bendy, FieldVariation.bendySinister
					]);
				}
				this.field.variation = variation;
				this.field.number = randomInt(3, 15);
				this.field.tinctureSecondary = baseTinctures.pop() ?? Tincture.argent;
				if(selectedFeatures.includes('fieldVariationWithLine')) {
					this.field.variationLine = randomFromArray([
						DivisionLine.embattled, DivisionLine.indented, DivisionLine.wavy
					]);
				}
			}
		}
		if(selectedFeatures.includes('charge')) {
			if(selectedFeatures.includes('ordinary')) {
				let ordinaryDevice = randomFromArray([...DEVICE.values()].filter(d => d.type == DeviceType.ordinary));
				let line = undefined;
				if(selectedFeatures.includes('ordinaryWithLine')) {
					line = randomFromArray([
						DivisionLine.embattled, DivisionLine.engrailed,
						DivisionLine.invected, DivisionLine.indented, DivisionLine.wavy,
					]);
				}
				let ordinary = new Part({device: ordinaryDevice, line: line});
				this.addCharge(ordinary);
				ordinary.randomize(selectedFeatures.includes('complexOrdinary') ? 2 : 0);
			} else {
				let mobileDevice = randomFromArray([...DEVICE.values()].filter(d => d.type == DeviceType.mobileCharge));
				let charge = new Part({device: mobileDevice});
				this.addCharge(charge);
				charge.randomize(selectedFeatures.includes('complexMobileCharge') ? 2 : 0);
				if(mobileDevice.id == DeviceId.mullet) {
					charge.chargeDegree = randomInt(5, 9);
				}
				if(selectedFeatures.includes('multiCharge')) {
					let count = randomInt(1, 9);
					for(let i=0; i<count; i++) {
						this.addCharge(charge.clone());
					}
				}
			}
		}
		if(selectedFeatures.includes('division')) {
			let type: DivisionType;
			if(selectedFeatures.includes('4PartDivision')) {
				type = randomFromArray([DivisionType.quarterly, DivisionType.saltire]);
			} else {
				type = randomFromArray([
					DivisionType.pale, DivisionType.fess, DivisionType.bend, DivisionType.bendSinister,
					DivisionType.chevron, DivisionType.chevronReversed,
				]);
			}
			let division = new Division(type, DivisionLine.straight);
			if(selectedFeatures.includes('divisionWithLine')) {
				division.line = randomFromArray([
					DivisionLine.embattled, DivisionLine.engrailed,
					DivisionLine.invected, DivisionLine.indented, DivisionLine.wavy,
				]);
			}
			this.divide(division);
			let childComplexity = Math.floor(complexity / (this.parts.length - 1));
			let otherParts = [...this.parts];
			otherParts.shift();
			for(let part of otherParts) {
				part.randomize(childComplexity);
			}
		}
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
				let dev = this.device;
				this.apply(firstSub);
				this.device = dev;
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

	public constructor(part: Partial<Field>) {
		this.apply(part);
	}

	public static createPlain(tincture: Tincture|null=null): Field {
		let field = new Field({ tincture: tincture ?? undefined });
		return field;
	}

	private apply(field: Partial<Field>) {
		this.variation = field.variation ?? FieldVariation.plain;
		this.tincture = field.tincture ?? Tincture.argent;
		this.tinctureSecondary = field.tinctureSecondary ?? Tincture.argent;
		this.number = field.number ?? 8;
		this.variationLine = field.variationLine ?? DivisionLine.straight;
	}

	public clone(): Field {
		let field = new Field(this);
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
	roundel, annulet, lozenge, mascle, mullet, heart, escutcheon, crescent, billet, tower, crown, key, trefoil
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
		{ id: DeviceId.annulet, type: DeviceType.mobileCharge },
		{ id: DeviceId.lozenge, type: DeviceType.mobileCharge },
		{ id: DeviceId.mascle, type: DeviceType.mobileCharge },
		{ id: DeviceId.mullet, type: DeviceType.mobileCharge },
		{ id: DeviceId.heart, type: DeviceType.mobileCharge },
		{ id: DeviceId.escutcheon, type: DeviceType.mobileCharge },
		{ id: DeviceId.crescent, type: DeviceType.mobileCharge },
		{ id: DeviceId.billet, type: DeviceType.mobileCharge },
		{ id: DeviceId.tower, type: DeviceType.mobileCharge },
		{ id: DeviceId.crown, type: DeviceType.mobileCharge },
		{ id: DeviceId.key, type: DeviceType.mobileCharge },
		{ id: DeviceId.trefoil, type: DeviceType.mobileCharge },
	];
	for(let device of devices) {
		map.set(device.id, device);
	}
	return map;
})();