const deviceNames = new Map<DeviceId, string>([
	[DeviceId.heater, 'Heater'],
	[DeviceId.kite, 'Kite'],
	[DeviceId.iberian, 'Square Iberian'],
	[DeviceId.french, 'French'],
	[DeviceId.english, 'English'],
	[DeviceId.swiss, 'Swiss'],
	[DeviceId.dutch, 'Dutch'],
	[DeviceId.cartouche, 'Cartouche'],
	[DeviceId.lozengeEscutcheon, 'Lozenge'],
	[DeviceId.banner, 'Banner'],
	[DeviceId.bend, 'Bend'],
	[DeviceId.bendSinister, 'Bend Sinister'],
	[DeviceId.fess, 'Fess'],
	[DeviceId.pale, 'Pale'],
	[DeviceId.chevron, 'Chevron'],
	[DeviceId.chevronReversed, 'Chevron Reversed'],
	[DeviceId.chief, 'Chief'],
	[DeviceId.base, 'Base'],
	[DeviceId.canton, 'Canton'],
	[DeviceId.quarter, 'Quarter'],
	[DeviceId.cross, 'Cross'],
	[DeviceId.saltire, 'Saltire'],
	[DeviceId.roundel, 'Roundel'],
	[DeviceId.annulet, 'Annulet'],
	[DeviceId.lozenge, 'Lozenge'],
	[DeviceId.mascle, 'Mascle'],
	[DeviceId.mullet, 'Mullet'],
	[DeviceId.heart, 'Heart'],
	[DeviceId.escutcheon, 'Escutcheon'],
	[DeviceId.crescent, 'Crescent'],
	[DeviceId.billet, 'Billet'],
	[DeviceId.tower, 'Tower'],
	[DeviceId.crown, 'Crown'],
	[DeviceId.key, 'Key'],
	[DeviceId.trefoil, 'Trefoil'],
	[DeviceId.sword, 'Sword'],
	[DeviceId.hilted, 'Hilted'],
	[DeviceId.lion, 'Lion'],
	[DeviceId.armed, 'Armed'],
	[DeviceId.langued, 'Langued'],
	[DeviceId.eagle, 'Eagle'],
	[DeviceId.griffin, 'Griffin'],
	[DeviceId.stag, 'Stag'],
	[DeviceId.hind, 'Hind'],
	[DeviceId.unguled, 'Unguled'],
	[DeviceId.unicorn, 'Unicorn'],
	[DeviceId.crined, 'Crined'],
]);

const attitudeNames = new Map([
	[Attitude.rampant, 'Rampant'],
	[Attitude.passant, 'Passant'],
	[Attitude.none, 'None'],
	[Attitude.default, 'Standard'],
	[Attitude.guardant, 'Guardant'],
	[Attitude.regardant, 'Regardant'],
	[Attitude.displayed, 'Displayed'],
	[Attitude.addorsed, 'Addorsed'],
	[Attitude.rising, 'Rising'],
	[Attitude.elevated, 'Elevated'],
	[Attitude.lowered, 'Lowered'],
	[Attitude.segreant, 'Segreant'],
	[Attitude.trippant, 'Trippant'],
	[Attitude.forcene, 'Forcené'],
]);

const divisionNames = new Map([
	[DivisionType.none, 'None'],
	[DivisionType.pale, 'Pale'],
	[DivisionType.fess, 'Fess'],
	[DivisionType.bend, 'Bend'],
	[DivisionType.bendSinister, 'Bend Sinister'],
	[DivisionType.chevron, 'Chevron'],
	[DivisionType.chevronReversed, 'Chevron Reversed'],
	[DivisionType.quarterly, 'Quarterly'],
	[DivisionType.saltire, 'Saltire'],
]);

const arrangementNames = new Map([
	[ChargeArrangement.unspecified, 'Default'],
	[ChargeArrangement.specified, 'Per Row'],
	[ChargeArrangement.bendwise, 'In Bend'],
	[ChargeArrangement.bendwiseSinister, 'In Bend Sinister'],
	[ChargeArrangement.chevronwise, 'In Chevron'],
	[ChargeArrangement.chevronwiseReversed, 'In Chevron Reversed'],
	[ChargeArrangement.crosswise, 'In Cross'],
	[ChargeArrangement.fesswise, 'In Fess'],
	[ChargeArrangement.palewise, 'In Pale'],
	[ChargeArrangement.saltirewise, 'In Saltire'],
])

const lineNames = new Map([
	[DivisionLine.straight, 'Straight'],
	[DivisionLine.indented, 'Indented'],
	[DivisionLine.wavy, 'Wavy'],
	[DivisionLine.embattled, 'Embattled'],
	[DivisionLine.engrailed, 'Engrailed'],
	[DivisionLine.invected, 'Invected'],
]);

const tinctureNames = new Map([
	[Tincture.or, 'Or'],
	[Tincture.argent, 'Argent'],
	[Tincture.azure, 'Azure'],
	[Tincture.gules, 'Gules'],
	[Tincture.sable, 'Sable'],
	[Tincture.vert, 'Vert'],
	[Tincture.purpure, 'Purpure'],
	[Tincture.ermine, 'Ermine'],
	[Tincture.vair, 'Vair'],
]);

const fieldVariationNames = new Map([
	[FieldVariation.plain, 'Plain'],
	[FieldVariation.barry, 'Barry'],
	[FieldVariation.paly, 'Paly'],
	[FieldVariation.bendy, 'Bendy'],
	[FieldVariation.bendySinister, 'Bendy Sinister'],
	[FieldVariation.chequy, 'Chequy'],
	[FieldVariation.lozengy, 'Lozengy'],
]);

function blazonPart(part: Part): string {
	let manyParts = part.parts.length > 2;
	let partBlazons = part.parts.map((child, i) => 
		`${manyParts ? ['I','II','III','IV'][i]+'. ' : ''} ${blazonPart(child)}`
	).join(manyParts ? '; ' : ' and ');
	let blazon = `${part.division.type != DivisionType.none ? blazonDivision(part.division)+' '+partBlazons : blazonField(part.field)}`;
	// charges
	if(part.charges.length) {
		let chargeGroups = part.groupCharges();
		blazon += `, ${![DeviceType.escutcheon, DeviceType.subdivision].includes(part.device.type) ? 'charged with ' : ''}${chargeGroups.map(g => {
			let charge = g[0];
			// name and number
			let name = deviceNames.get(charge.device.id)!;
			if(g.length == 1) {
				name = `${['a','e','i','o'].includes(name.charAt(0).toLowerCase()) ? 'an' : 'a'} ${name}`;
			} else {
				let nameParts = name.split(' ');
				nameParts[0] += nameParts[0].charAt(nameParts[0].length-1) == 's' ? 'es' : 's';
				name = `${g.length} ${nameParts.join(' ')}`;
			}
			if(charge.device.type == DeviceType.ordinary && charge.line != DivisionLine.straight) {
				name += ' ' + lineNames.get(charge.line)!.toLowerCase();
			}
			if(charge.chargeDegree > 1) {
				name += ` of ${charge.chargeDegree}${charge.device.id == DeviceId.mullet ? ' points' : ''}`;
			}
			// attitude
			let fullAttitude = '';
			let isOnlyHead = charge.attitudes[
				charge.device.attitudeSets?.findIndex(
					s => [AttitudeSetId.beastBody, AttitudeSetId.birdBody
				].includes(s.id)) ?? -1
			] == Attitude.none;
			if(charge.device.attitudeSets) {
				let attitudeWords: string[] = [];
				if(isOnlyHead) {
					attitudeWords.push('\'s head');
				}
				for(let idx in charge.device.attitudeSets) {
					let set = charge.device.attitudeSets[idx];
					let attitude = charge.attitudes[idx];
					if((idx != '0' && attitude == set.options[0]) || (isOnlyHead && set.id != AttitudeSetId.beastHead)) {
						continue;
					}
					let attitudeLabel = attitudeNames.get(attitude)!.toLowerCase();
					if([AttitudeSetId.birdWingDirection, AttitudeSetId.birdWingPosition].includes(set.id)) {
						if(!attitudeWords.includes('wings')) {
							attitudeWords.push('wings');
						} else {
							attitudeWords.push('and');
						}
					}
					attitudeWords.push(attitudeLabel);
				}
				fullAttitude = attitudeWords.join(' ');
				if(!isOnlyHead) {
					fullAttitude = ' '+fullAttitude;
				}
			}
			// features
			let features = '';
			if(charge.device.children) {
				let featurePairs = charge.device.children.map((feature, idx) => ({
					feature: feature.id, tincture: charge.featureTinctures[idx],
				})).filter(f => f.tincture && !(isOnlyHead && f.feature == DeviceId.unguled));
				let groupedByTincture: {feature:DeviceId, tincture:Tincture|null}[][] = [];
				for(let pair of featurePairs) {
					let group = groupedByTincture.find(g => g[0].tincture == pair.tincture);
					if(!group) {
						group = [pair];
						groupedByTincture.push(group);
					} else {
						group.push(pair);
					}
				}
				features = groupedByTincture.map(g => g.map(
					f => deviceNames.get(f.feature)!.toLowerCase()).join(' and ')+' '+tinctureNames.get(g[0].tincture!)
				).join(', ');
			}
			// full charge
			return `${name}${fullAttitude} ${blazonPart(charge)}${features ? ', '+features : ''}`;
		}).join(' and ')}`;
		// charge arrangement
		if(part.charges.filter(c => [DeviceType.mobileCharge, DeviceType.beast].includes(c.device.type)).length > 1) {
			let arrangement = '';
			if(part.chargeArrangement == ChargeArrangement.specified) {
				arrangement = `, ${part.chargeCountByRow.join(' and ')}`;
			} else if(part.chargeArrangement != ChargeArrangement.unspecified) {
				arrangement = ' '+arrangementNames.get(part.chargeArrangement)!.toLowerCase();
			}
			blazon += arrangement;
		}
	}
	if(part.device.type == DeviceType.escutcheon) {
		blazon += '.';
	}
	return blazon;
}

function blazonDivision(division: Division): string {
	if(division.type == DivisionType.none) {
		return '';
	}
	let blazon = divisionNames.get(division.type)!;
	if(division.type != DivisionType.quarterly) {
		blazon = `Per ${blazon.toLowerCase()}`;
	}
	if(division.line != DivisionLine.straight) {
		blazon += ` ${lineNames.get(division.line)?.toLowerCase()}`;
	}
	return blazon;
}

function blazonField(field: Field): string {
	let tincture = tinctureNames.get(field.tincture)!;
	if(field.variation == FieldVariation.plain) {
		return tincture;
	} else {
		let numberText = `of ${field.number}${field.variation == FieldVariation.chequy ? ' columns' : (field.variation == FieldVariation.lozengy ? ' tracts' : '')}`;
		let lineText = field.variationLine != DivisionLine.straight ? lineNames.get(field.variationLine)!.toLowerCase()+' ' : '';
		return `${fieldVariationNames.get(field.variation)} ${lineText}${numberText}, ${tincture} and ${tinctureNames.get(field.tinctureSecondary)}`;
	}
}
