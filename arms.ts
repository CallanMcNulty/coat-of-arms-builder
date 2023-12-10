class Part {
	parent: Part|null = null;
	device: Device;
	attitudes: Attitude[] = [];
	field: Field;
	featureTinctures: (Tincture|null)[] = [];
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
		this.attitudes = [...(part.attitudes ?? [])];
		this.field = part.field ? new Field(part.field) : Field.createPlain(part.device?.properTincture);
		this.featureTinctures = [...(part.featureTinctures ?? [])];
		this.charges = (part.charges ?? []).map(c => new Part(c));
		this.charges.forEach(c => c.parent = this);
		this.chargeArrangement = part.chargeArrangement ?? ChargeArrangement.unspecified;
		this.chargeCountByRow = [...(part.chargeCountByRow ?? [this.charges.length])];
		this.division = part.division ?? new Division(DivisionType.none, DivisionLine.straight);
		this.parts = (part.parts ?? []).map(p => new Part(p));
		this.line = part.line ?? DivisionLine.straight;
		this.chargeDegree = part.chargeDegree ?? (this.device.id == DeviceId.mullet ? 5 : 1);
		this.updateDevice(this.device);
	}

	public randomize(degree: number) {
		let complexity = degree;
		let parentTinctures: Tincture[] = [];
		let sameTypeTinctures: Tincture[] = [];
		let metals = [Tincture.or, Tincture.argent];
		let colors = [Tincture.azure, Tincture.gules, Tincture.sable, Tincture.vert, Tincture.purpure];
		let furs = [Tincture.ermine, Tincture.vair];
		let parent = this.parent;
		while(parent) {
			let parentParts = [...parent.parts.filter(p => p != this)];
			if(!parentParts.length) {
				parentParts.push(parent);
			}
			let potentiallyClashing = this.device.type == DeviceType.ordinary ? parent.charges.filter(c => c != this) : [];
			parentParts.push(...potentiallyClashing);
			parentTinctures.push(...parentParts.flatMap(p => {
				let tinctures = [p.field.tincture];
				if(p.field.variation != FieldVariation.plain) {
					tinctures.push(p.field.tinctureSecondary);
				}
				if(furs.includes(p.field.tincture)) {
					if(p.field.tincture == Tincture.vair) {
						tinctures.push(Tincture.azure, Tincture.argent);
					} else {
						tinctures.push(Tincture.sable, Tincture.argent);
					}
				}
				return tinctures;
			}));
			if(!parent.parts.length) {
				if(metals.includes(parent.field.tincture)) {
					sameTypeTinctures = metals;
				} else if(colors.includes(parent.field.tincture)) {
					sameTypeTinctures = colors;
				}
			}
			parent = parent.parent;
		}
		let disallowedTinctures = [...shuffleArray(parentTinctures), ...shuffleArray(sameTypeTinctures)];
		let baseTinctures = shuffleArray([...metals, ...colors]).filter(t => !disallowedTinctures.includes(t));
		let field = Field.createPlain(baseTinctures.pop() ?? disallowedTinctures.pop());
		this.apply({field:field, parent:this.parent, device:this.device});
		// handle extra feature colors
		if(this.device.children) {
			let featureColor = null;
			for(let ti in this.featureTinctures) {
				let currentTincture = this.featureTinctures[ti]!;
				if(parentTinctures.includes(currentTincture)) {
					if(featureColor == null) {
						let possibleTinctures = shuffleArray([...metals, ...colors]).filter(t => !parentTinctures.includes(t));
						featureColor = possibleTinctures.pop() ?? field.tincture;
					}
					this.featureTinctures[ti] = featureColor;
				}
			}
		}
		// attitude
		for(let attitudeIdx in this.attitudes) {
			let set = this.device.attitudeSets![attitudeIdx];
			if(Math.random() < .4) {
				this.attitudes[attitudeIdx] = randomFromArray(set.options);
			}
		}
		if(this.device.id == DeviceId.eagle && this.attitudes[0] == Attitude.displayed) {
			this.attitudes[1] = Attitude.displayed; // don't allow displayed body, addorsed wings
		}
		if(complexity <= 0) {
			return;
		}
		// add complexity
		let features = [
			{ feature: 'charge', cost:1, subFeatures:[
				{ feature: 'ordinary', cost:1, subFeatures:[
					{ feature: 'ordinaryWithLine', cost:1, subFeatures:[] },
					{ feature: 'complexOrdinary', cost:3, subFeatures:[] },
				]},
				{ feature: 'multiCharge', cost:1, subFeatures:[] },
				{ feature: 'complexMobileCharge', cost:4, subFeatures:[] },
				{ feature: 'beast', cost:1, subFeatures:[] },
			]},
			{ feature: 'field', cost:0, subFeatures:[
				{ feature: 'fur', cost:2, subFeatures:[] },
				{ feature: 'fieldVariation', cost:2, subFeatures:[
					{ feature: 'fieldVariationWithLine', cost:1, subFeatures:[] },
					{ feature: 'complexFieldVariation', cost:2, subFeatures:[] },
				]},
			]},
			{ feature: 'division', cost:3, subFeatures:[
				{ feature: 'divisionWithLine', cost:2, subFeatures:[] },
				{ feature: '4PartDivision', cost:2, subFeatures:[] },
			]},
		];
		let selectedFeatures: string[] = [];
		while(complexity && selectedFeatures.length < 4) {
			features = shuffleArray(features.filter(f => !(
				f.cost > complexity
				|| (selectedFeatures.includes('division') && !['divisionWithLine', '4PartDivision'].includes(f.feature))
				|| ((selectedFeatures.includes('fur') || selectedFeatures.includes('fieldVariation')) &&
					['fur', 'fieldVariation'].includes(f.feature)
				)
				|| (f.feature == 'division' && this.device.type == DeviceType.subdivision)
				|| (f.feature == 'ordinary' && this.device.type == DeviceType.ordinary)
				|| ((this.parent?.division.type == DivisionType.chevron && this.parent?.parts.indexOf(this) == 0) ||
					(this.parent?.division.type == DivisionType.chevronReversed && this.parent?.parts.indexOf(this) == 1)
				)
			)));
			let selected = features.pop();
			if(selected) {
				complexity -= selected.cost;
				if(selected.subFeatures.length) {
					features.push(...selected.subFeatures);
				}
				if(selected?.feature == 'division') {
					selectedFeatures = [selected.feature];
					if(Math.random() < .5) {
						break;
					}
				} else {
					selectedFeatures.push(selected.feature);
				}
			} else {
				break;
			}
		}
		if(selectedFeatures.includes('field')) {
			if(selectedFeatures.includes('fur')) {
				let allowedFurs = furs.filter(f => !parentTinctures.includes(f));
				if(allowedFurs.length) {
					this.field.tincture = randomFromArray(allowedFurs);
				}
			}
			if(selectedFeatures.includes('fieldVariation')) {
				let variation: FieldVariation;
				if(selectedFeatures.includes('complexFieldVariation')) {
					variation = randomFromArray([FieldVariation.chequy, FieldVariation.lozengy]);
				} else {
					variation = randomFromArray([
						FieldVariation.barry, FieldVariation.paly, FieldVariation.bendy, FieldVariation.bendySinister
					]);
				}
				this.field.variation = variation;
				this.field.number = randomInt(4, 13);
				this.field.tinctureSecondary = baseTinctures.pop() ?? sameTypeTinctures.pop() ?? Tincture.argent;
				if(selectedFeatures.includes('fieldVariationWithLine')) {
					this.field.variationLine = randomFromArray([
						DivisionLine.embattled, DivisionLine.indented, DivisionLine.wavy
					]);
				}
			}
		}
		if(selectedFeatures.includes('charge')) {
			if(selectedFeatures.includes('beast')) {
				let beast = new Part({device: randomFromArray([...DEVICE.values()].filter(d => d.type == DeviceType.beast))});
				this.addCharge(beast);
				beast.randomize(0);
			} else if(selectedFeatures.includes('ordinary')) {
				const disallowedOrdinaries = [DeviceId.chief, DeviceId.base, DeviceId.canton, DeviceId.quarter];
				let ordinaryDevice = randomFromArray([...DEVICE.values()]
					.filter(d => d.type == DeviceType.ordinary && !disallowedOrdinaries.includes(d.id)))
				;
				let line = undefined;
				if(selectedFeatures.includes('ordinaryWithLine')) {
					line = randomFromArray([
						DivisionLine.embattled, DivisionLine.engrailed,
						DivisionLine.invected, DivisionLine.indented, DivisionLine.wavy,
					]);
				}
				let ordinary = new Part({device: ordinaryDevice, line: line});
				this.addCharge(ordinary);
				ordinary.randomize(selectedFeatures.includes('complexOrdinary') ? 3 : 0);
			} else {
				let complex = selectedFeatures.includes('complexMobileCharge');
				let mobileDevice = randomFromArray([...DEVICE.values()].filter(d => {
					if(d.type != DeviceType.mobileCharge) {
						return false;
					}
					return !(complex &&
						![DeviceId.billet,DeviceId.escutcheon,DeviceId.heart,DeviceId.lozenge,DeviceId.roundel].includes(d.id)
					);
				}));
				let charge = new Part({device: mobileDevice});
				this.addCharge(charge);
				charge.randomize(complex ? 3 : 0);
				if(mobileDevice.id == DeviceId.mullet) {
					charge.chargeDegree = randomInt(5, 9);
				}
				if(selectedFeatures.includes('multiCharge')) {
					let count = randomInt(1, 7);
					if(count >= 3 && count%2 == 0) {
						count++;
					}
					for(let i=0; i<count; i++) {
						this.addCharge(new Part(charge));
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
			for(let partIdx=0; partIdx<(type == DivisionType.saltire ? 3 : 2); partIdx++) {
				this.parts[partIdx].randomize(2);
			}
			if(this.parts.length > 2) {
				this.parts[2].apply(this.parts[1]);
				if(type == DivisionType.quarterly && Math.random() < .5) {
					this.parts[3].apply(this.parts[0]);
				} else {
					this.parts[3].randomize(2);
				}
			}
		}
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
			this.chargeCountByRow.join() == other.chargeCountByRow.join() &&
			this.featureTinctures.join() == other.featureTinctures.join() &&
			this.attitudes.join() == other.attitudes.join()
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

	public updateDevice(newDevice: Device) {
		this.device = newDevice;
		let featureCount = this.device.children?.length ?? 0;
		while(this.featureTinctures.length > featureCount) {
			this.featureTinctures.pop();
		}
		while(this.featureTinctures.length < featureCount) {
			this.featureTinctures.push(this.device.children![this.featureTinctures.length].properTincture ?? null);
		}
		this.attitudes = (newDevice.attitudeSets ?? []).map((set,i) => this.attitudes[i] ?? set.options[0]);
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

	public updateMobileChargeGroupDeviceAndNumber(charge: Part, device: Device, number: number) {
		let groupIndex = this.charges.findIndex(c => c.equals(charge));
		let precedingCharges = this.charges.slice(0,groupIndex);
		let followingCharges = this.charges.slice(this.charges.findLastIndex(c => c.equals(charge)) + 1);
		if(charge.device != device) {
			charge.updateDevice(device);
		}
		let newCharges = [];
		while(newCharges.length < number) {
			newCharges.push(new Part(charge));
		}
		this.charges = [];
		let allCharges = [...precedingCharges, ...newCharges, ...followingCharges];
		for(let charge of allCharges) {
			this.addCharge(charge);
		}
		if(number == 1) {
			this.chargeArrangement = ChargeArrangement.unspecified;
		}
	}

	public divide(div: Division): void {
		if(div.type == DivisionType.none) {
			let firstSub = this.parts[0];
			if(firstSub) {
				let dev = this.device;
				let parent = this.parent;
				this.apply(firstSub);
				this.updateDevice(dev);
				this.parent = parent;
			}
			return;
		}
		let desiredPartCount = 2;
		if(div.type == DivisionType.quarterly || div.type == DivisionType.saltire) {
			desiredPartCount = 4;
		}
		while(this.parts.length < desiredPartCount) {
			let newPart = new Part(this.parts.length ? {} : new Part(this));
			newPart.parent = this;
			newPart.device = DEVICE.get(DeviceId.sub)!;
			this.parts.push(newPart);
		}
		this.division = div;
		this.charges = [];
	}

	public groupCharges(): Part[][] {
		let chargeGroups: Part[][] = [];
		for(let charge of this.charges) {
			let latestGroup = chargeGroups[chargeGroups.length-1];
			if(latestGroup && latestGroup[0].equals(charge)) {
				latestGroup.push(charge);
			} else {
				chargeGroups.push([charge]);
			}
		}
		return chargeGroups;
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
}

enum ChargeArrangement {
	unspecified,
	specified,
	inBend,
	inBendSinister,
	inChevron,
	inChevronReversed,
	inCross,
	inFess,
	inPale,
	inSaltire,
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

class AttitudeSet {
	id: AttitudeSetId;
	options: Attitude[];
}

enum AttitudeSetId {
	beastBody,
	beastHead,
	birdBody,
	birdWingPosition,
	birdWingDirection,
}

enum Attitude {
	default,
	none,
	rampant,
	passant,
	regardant,
	guardant,
	displayed,
	addorsed,
	rising,
	elevated,
	lowered,
	segreant,
	trippant,
	forcene,
}

class Device {
	id: DeviceId;
	type: DeviceType;
	properTincture?: Tincture;
	children?: Device[];
	attitudeSets?: AttitudeSet[];
}

enum DeviceType {
	escutcheon,
	mobileCharge,
	beast,
	ordinary,
	subdivision,
	feature,
}

enum DeviceId {
	heater, kite, iberian, french, english, swiss, dutch, cartouche, lozengeEscutcheon, banner,
	sub,
	bend, bendSinister, fess, pale, chevron, chevronReversed, canton, quarter, chief, base, cross, saltire,
	roundel, annulet, lozenge, mascle, mullet, heart, escutcheon, crescent, billet, tower, crown, key, trefoil, sword,
	lion, eagle, stag, hind, griffin, unicorn,
	hilted, langued, armed, unguled, crined,
}

const DEVICE: Map<DeviceId, Device> = (() => {
	let map = new Map();
	const langued = { id: DeviceId.langued, type: DeviceType.feature, properTincture:Tincture.gules };
	const armed = { id: DeviceId.armed, type: DeviceType.feature, properTincture:Tincture.argent };
	const unguled = { id: DeviceId.unguled, type: DeviceType.feature, properTincture:Tincture.argent };
	let devices: Device[] = [
		{ id: DeviceId.heater, type: DeviceType.escutcheon },
		{ id: DeviceId.kite, type: DeviceType.escutcheon },
		{ id: DeviceId.iberian, type: DeviceType.escutcheon },
		{ id: DeviceId.french, type: DeviceType.escutcheon },
		{ id: DeviceId.english, type: DeviceType.escutcheon },
		{ id: DeviceId.swiss, type: DeviceType.escutcheon },
		{ id: DeviceId.dutch, type: DeviceType.escutcheon },
		{ id: DeviceId.cartouche, type: DeviceType.escutcheon },
		{ id: DeviceId.lozengeEscutcheon, type: DeviceType.escutcheon },
		{ id: DeviceId.banner, type: DeviceType.escutcheon },

		{ id: DeviceId.sub, type: DeviceType.subdivision },

		{ id: DeviceId.bend, type: DeviceType.ordinary, properTincture: Tincture.or },
		{ id: DeviceId.bendSinister, type: DeviceType.ordinary, properTincture: Tincture.or },
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

		{ id: DeviceId.roundel, type: DeviceType.mobileCharge, properTincture: Tincture.argent },
		{ id: DeviceId.annulet, type: DeviceType.mobileCharge },
		{ id: DeviceId.lozenge, type: DeviceType.mobileCharge },
		{ id: DeviceId.mascle, type: DeviceType.mobileCharge },
		{ id: DeviceId.mullet, type: DeviceType.mobileCharge, properTincture: Tincture.or },
		{ id: DeviceId.heart, type: DeviceType.mobileCharge, properTincture: Tincture.gules },
		{ id: DeviceId.escutcheon, type: DeviceType.mobileCharge },
		{ id: DeviceId.crescent, type: DeviceType.mobileCharge, properTincture: Tincture.argent },
		{ id: DeviceId.billet, type: DeviceType.mobileCharge },
		{ id: DeviceId.tower, type: DeviceType.mobileCharge },
		{ id: DeviceId.crown, type: DeviceType.mobileCharge, properTincture: Tincture.or },
		{ id: DeviceId.key, type: DeviceType.mobileCharge, properTincture: Tincture.or },
		{ id: DeviceId.trefoil, type: DeviceType.mobileCharge, properTincture: Tincture.vert },
		{ id: DeviceId.sword, type: DeviceType.mobileCharge, properTincture: Tincture.argent, children:[
			{ id: DeviceId.hilted, type: DeviceType.feature, properTincture: Tincture.or },
		]},
		{ id: DeviceId.lion, type: DeviceType.beast,
			children:[langued, armed],
			attitudeSets: [
				{ id:AttitudeSetId.beastBody, options:[Attitude.rampant, Attitude.passant, Attitude.none] },
				{ id:AttitudeSetId.beastHead, options:[Attitude.default, Attitude.regardant, Attitude.guardant] },
			],
		},
		{ id: DeviceId.eagle, type: DeviceType.beast,
			children:[langued, armed],
			attitudeSets: [
				{ id:AttitudeSetId.birdBody, options:[Attitude.displayed, Attitude.rising, Attitude.none] },
				{ id:AttitudeSetId.birdWingPosition, options:[Attitude.displayed, Attitude.addorsed] },
				{ id:AttitudeSetId.birdWingDirection, options:[Attitude.elevated, Attitude.lowered] },
			],
		},
		{ id: DeviceId.stag, type: DeviceType.beast,
			children:[langued, armed, unguled],
			attitudeSets: [
				{ id:AttitudeSetId.beastBody, options:[Attitude.forcene, Attitude.trippant, Attitude.none] },
				{ id:AttitudeSetId.beastHead, options:[Attitude.default, Attitude.regardant, Attitude.guardant] },
			],
		},
		{ id: DeviceId.hind, type: DeviceType.beast,
			children:[langued, unguled],
			attitudeSets: [
				{ id:AttitudeSetId.beastBody, options:[Attitude.forcene, Attitude.trippant, Attitude.none] },
				{ id:AttitudeSetId.beastHead, options:[Attitude.default, Attitude.regardant, Attitude.guardant] },
			],
		},
		{ id: DeviceId.griffin, type: DeviceType.beast,
			children:[langued, armed],
			attitudeSets: [
				{ id:AttitudeSetId.beastBody, options:[Attitude.segreant, Attitude.passant, Attitude.none] },
				{ id:AttitudeSetId.beastHead, options:[Attitude.default, Attitude.regardant] },
				{ id:AttitudeSetId.birdWingDirection, options:[Attitude.elevated, Attitude.lowered] },
			],
		},
		{ id: DeviceId.unicorn, type: DeviceType.beast,
			children:[langued, { id: DeviceId.crined, type: DeviceType.feature }, armed, unguled],
			attitudeSets: [
				{ id:AttitudeSetId.beastBody, options:[Attitude.forcene, Attitude.trippant, Attitude.none] },
				{ id:AttitudeSetId.beastHead, options:[Attitude.default, Attitude.regardant] },
			],
		},
	];
	for(let device of devices) {
		map.set(device.id, device);
	}
	return map;
})();