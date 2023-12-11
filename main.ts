function randomBetween(min: number|number[], max: number|number[]) {
	if(typeof min == 'object') {
		min = Math.max(...min);
	}
	if(typeof max == 'object') {
		max = Math.min(...max);
	}
	return Math.random()*(max - min) + min;
}

function randomInt(min: number, max: number): number {
	return Math.floor(randomBetween(min, max));
}

function randomFromArray<T>(arr: T[]): T {
	return arr[randomInt(0, arr.length)];
}

function shuffleArray<T>(array: T[]): T[] {
	return array.map(item => ({n:Math.random(), i:item})).sort((a,b) => a.n - b.n).map(o => o.i);
}

function inflate(html: string): HTMLElement {
	const template = document.createElement('template');
	html = html.trim();
	template.innerHTML = html;
	return template.content.firstChild as HTMLElement;
}

function getSvg(paths: PathData[]): string {
	return paths.length ? `
		<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="-50 -50 100 100">
		${paths.map(f => f.path ? `
			<path
				d="${f.path}"
				fill="${f.line ? 'none' : f.color}"
				stroke-linecap="round"
				stroke-width="${f.line ? f.lineWeight ?? 1 : ''}"
				stroke="${f.line ? f.color : ''}"
				opacity="${f.opacity ?? 1 < 1 ? f.opacity : ''}"
			/>
		` : '').join('\n')}
		</svg>
	` : ''
}

function getAncestralCustomDataElement(element: any): HTMLElement {
	let el = element;
	while(!el.arms) {
		el = el.parentNode as HTMLElement;
	}
	return el;
}

class EditorUIState {
	part: Part;
	inProgressField: Field;
	inProgressDivision: Division;
	selectedChargeClassIndex: number;
	selectedCharge: number;
	selectedChargeArrangement: number;
	selectedReversed: boolean;
	selectedInverted: boolean;
	additionalCollapsedParts: Part[]|null = null;
	updatedEditorIndex: number|null = null;

	constructor(part: Part, additionalCollapsedParts: Part[]|null) {
		this.part = part;
		this.inProgressField = new Field(part.field);
		this.inProgressDivision = new Division(part.division.type, part.division.line);
		this.selectedChargeClassIndex = [
			DeviceType.ordinary, DeviceType.mobileCharge, DeviceType.beast
		].indexOf(part.device.type);
		this.selectedCharge = part.device.id;
		this.selectedChargeArrangement = part.chargeArrangement;
		this.selectedReversed = part.reversed;
		this.selectedInverted = part.inverted;
		this.additionalCollapsedParts = additionalCollapsedParts;
	}
}

class ShieldUpdate {
	func?: (data: EditorUIState, el:HTMLElement) => boolean;
}

function getEditor(part: Part, collapsed: Part[]|null=null): HTMLElement {
	let shieldSvg = inflate(getSvg(calcShieldElements(shield, [part, ...(collapsed ?? [])])));
	shieldSvg.setAttribute('viewBox', '-55 -55 110 110');
	let editor = inflate(`
		<div class="part-editor" style="padding-left:3em;">
			<div style="background-color:wheat; padding:.5em; margin-top:1em; box-shadow:0 0 1em black; display:inline-flex;">
				<div style="display:flex; flex-direction:column; margin-right:.25em; font-size:1.6em;">
					<i class="fas fa-chevron-circle-up move-button" style="margin-bottom:.1em;"></i>
					<i class="fas fa-chevron-circle-down move-button"></i>
					<div style="flex-grow:1;"></div>
					<i class="fas fa-minus-circle remove-button"></i>
					<i class="fas fa-plus-circle add-button" style="margin-top:.1em;"></i>
				</div>
				<div class="shieldHolder" style="width:9.5em; height:9.5em; background-color:#0007;"></div>
			</div>
		</div>
	`);
	// add control button listeners
	editor.querySelectorAll('i').forEach(i => i.style.cursor = 'pointer');
	(editor.querySelector('.add-button')! as HTMLButtonElement).onclick = event => {
		event.target?.dispatchEvent(createUpdateEvent({
			func: (ui, el) => {
				ui.part.addCharge(new Part({ device: DEVICE.get(DeviceId.roundel) }));
				return true;
			},
		}));
	};
	(editor.querySelector('.remove-button')! as HTMLButtonElement).onclick = event => {
		event.target?.dispatchEvent(createUpdateEvent({
			func: (ui, el) => {
				let chargeGroup = [ui.part, ...(ui.additionalCollapsedParts ?? [])];
				ui.part.parent!.charges = ui.part.parent!.charges.filter(c => !chargeGroup.includes(c));
				return true;
			},
		}));
	};
	editor.querySelectorAll('.move-button').forEach((button, i) => {
		(button as HTMLElement).onclick = event => {
			event.target?.dispatchEvent(createUpdateEvent({
				func: (ui, el) => {
					let direction = i ? 1 : -1;
					let chargeGroups = ui.part.parent!.groupCharges();
					let currentIdx = chargeGroups.findIndex(g => g.includes(ui.part));
					let currentGroup = chargeGroups[currentIdx];
					chargeGroups[currentIdx] = chargeGroups[currentIdx + direction];
					chargeGroups[currentIdx + direction] = currentGroup;
					ui.part.parent!.charges = chargeGroups.flat();
					return true;
				},
			}));
		}
	});
	// add update listener
	editor.addEventListener('shield-update', (event: CustomEvent<ShieldUpdate>) => {
		let el = event.currentTarget as HTMLElement;
		let state = (el as any).arms as EditorUIState;
		if(event.detail.func) {
			let needsFullUpdate = event.detail.func(state, el);
			if(!needsFullUpdate) {
				updateSingleEditor(el, state);
				event.stopPropagation();
			} else {
				event.detail.func = () => true;
				if(state.additionalCollapsedParts?.length) {
					state.additionalCollapsedParts.forEach(p => {
						if(state.part.parent) {
							state.part.parent.charges[state.part.parent.charges.indexOf(p)] = new Part(state.part);
						}
					});
				}
				window.setTimeout(updateShield, 0);
				if(state.part == shield) {
					updateEditor(el, state.part);
				}
			}
		}
	});
	// update & add children
	let ui = new EditorUIState(part, collapsed);
	updateSingleEditor(editor, ui);
	(editor as any).arms = ui;
	editor.querySelector('.shieldHolder')?.appendChild(shieldSvg);
	for(let subdivision of part.parts) {
		editor.appendChild(getEditor(subdivision));
	}
	let chargeGroups = part.groupCharges();
	for(let group of chargeGroups) {
		let charge = group.shift()!;
		editor.appendChild(getEditor(charge, group));
	}
	return editor;
}

function getFieldFromUI(el: HTMLElement) {
	let variationSelect = el.querySelector('.field-variation-select') as HTMLSelectElement;
	let tinctureSelect = el.querySelector('.field-tincture-select') as HTMLSelectElement;
	let tinctureSecondarySelect = el.querySelector('.field-tincture-secondary-select') as HTMLSelectElement;
	let numberInput = el.querySelector('.field-number-input') as HTMLInputElement;
	let lineSelect = el.querySelector('.field-line-select') as HTMLSelectElement;
	let field = Field.createPlain(parseInt(tinctureSelect.value));
	field!.variation = parseInt(variationSelect.value);
	if(tinctureSecondarySelect) {
		field!.tinctureSecondary = parseInt(tinctureSecondarySelect.value);
	}
	if(numberInput) {
		field!.number = Math.max(0, parseInt(numberInput.value));
	}
	if(lineSelect) {
		field!.variationLine = parseInt(lineSelect.value);
	}
	return field;
}

function getDivisionFromUI(el: HTMLElement) {
	let typeSelect = el.querySelector('.division-type-select') as HTMLSelectElement;
	let lineSelect = el.querySelector('.division-line-select') as HTMLSelectElement;
	return new Division(parseInt(typeSelect.value), lineSelect ? parseInt(lineSelect.value) : DivisionLine.straight);
}

function createUpdateEvent(update: ShieldUpdate): CustomEvent<ShieldUpdate> {
	return new CustomEvent('shield-update', { bubbles:true, detail:update });
}

function updateSingleEditor(editor: HTMLElement, uiState: EditorUIState) {
	let row = editor.children[0];
	let rowChildren = [...row.querySelectorAll('.editor-section')];
	for(let child of rowChildren) {
		row.removeChild(child);
	}
	// control buttons
	let removeButton = row.querySelector('.remove-button')! as HTMLElement;
	removeButton.style.display = 'none';
	let moveButtons = [...row.querySelectorAll('.move-button')] as HTMLElement[];
	for(let button of moveButtons) {
		button.style.display = 'none';
	}
	if(![DeviceType.subdivision, DeviceType.escutcheon].includes(uiState.part.device.type)) {
		removeButton.style.display = 'inline-block';
		let chargeIndex = uiState.part.parent!.charges.findIndex(c => c == uiState.part);
		for(let i in uiState.part.parent!.charges) {
			if(uiState.part.parent!.charges[i].equals(uiState.part)) {
				continue;
			}
			if(parseInt(i) < chargeIndex) {
				moveButtons[0].style.display = 'inline-block';
			} else {
				moveButtons[1].style.display = 'inline-block';
			}
		}
	}
	// begin section setup
	let sections = [
		{
			title: 'Division', buttonText: 'Divide',
			buttonFunc: (event:MouseEvent) => {
				event.target?.dispatchEvent(createUpdateEvent({
					func: (ui, el) => {
						ui.part.divide(getDivisionFromUI(el));
						return true;
					},
				}));
			},
			contentRows: [
				`
					<label>Per:</label>
					<select class="division-type-select">
					${[
						DivisionType.none, DivisionType.pale, DivisionType.fess, DivisionType.bend, DivisionType.bendSinister,
						DivisionType.chevron, DivisionType.chevronInverted, DivisionType.quarterly, DivisionType.saltire,
					].map(div => `
						<option value="${div}"${uiState.inProgressDivision.type == div ? ' selected' : ''}>
							${divisionNames.get(div)}
						</option>
					`).join('\n')}
					</select>
				`,
				...(uiState.inProgressDivision.type != DivisionType.none ? [`
					<label>Line:</label>
					<select class="division-line-select">
					${[
						DivisionLine.straight, DivisionLine.indented, DivisionLine.wavy,
						DivisionLine.embattled, DivisionLine.engrailed, DivisionLine.invected,
					].map(line => `
						<option value="${line}"${uiState.inProgressDivision.line == line ? ' selected' : ''}>
							${lineNames.get(line)}
						</option>
					`).join('\n')}
					</select>
				`] : []),
			],
			setUpListeners: (el: HTMLElement) => {
				(el.querySelector('.division-type-select') as HTMLSelectElement).onchange = event => {
					event.target?.dispatchEvent(createUpdateEvent({
						func: (ui, e) => {
							ui.inProgressDivision = getDivisionFromUI(e);
							return false;
						},
					}));
				};
			},
		},
	];
	// orientation section
	if(uiState.part.device.type == DeviceType.mobileCharge && uiState.part.device.symmetry < 3) {
		sections.unshift({
			title: 'Orientation', buttonText: 'Orient',
			buttonFunc: (event:MouseEvent) => {
				event.target?.dispatchEvent(createUpdateEvent({
					func: (ui, el) => {
						let selector = el.querySelector('.orientation-select');
						ui.part.updateOrientation(parseInt((selector as HTMLSelectElement).value));
						ui.part.inverted = ui.selectedInverted;
						ui.part.reversed = ui.selectedReversed;
						return true;
					},
				}));
			},
			contentRows: [
				`
					<label>Orientation:</label>
					<select class="orientation-select">
					${[...orientationNames.entries()].map(pair => `
						<option value="${pair[0]}"${uiState.part.getEffectiveOrientation() == pair[0] ? ' selected' : ''}>
							${pair[1]}
						</option>
					`).join('\n')}
					</select>
				`,
				[uiState.selectedReversed, uiState.selectedInverted].map((val,i) => uiState.part.device.symmetry <= i ? `
					<label>${i ? 'Inverted' : 'Reversed'}:</label>
					<i id="${i ? 'inverted' : 'reversed'}" style="vertical-align:bottom;"
						class="checkbox far fa-${val ? 'check-' : ''}square"
					></i>
				` : '').filter(t => t).join('<span style="display:inline-block; width:1em;"></span>'),
			],
			setUpListeners: (el: HTMLElement) => {
				([...el.querySelectorAll('.checkbox')] as HTMLElement[]).map(check => check.onclick = event => {
					let selected = check.classList.contains('fa-check-square');
					if(check.id == 'reversed') {
						uiState.selectedReversed = !selected;
					} else if(check.id == 'inverted') {
						uiState.selectedInverted = !selected;
					}
					event.target?.dispatchEvent(createUpdateEvent({
						func: (ui, e) => {
							return false;
						},
					}));
				});
			},
		});
	}
	// attitude section
	if(uiState.part.device.attitudeSets?.length) {
		const attitudeSetLabelMap = new Map([
			[AttitudeSetId.beastBody, 'Body'],
			[AttitudeSetId.beastHead, 'Head'],
			[AttitudeSetId.birdBody, 'Body'],
			[AttitudeSetId.birdWingPosition, 'Wings'],
			[AttitudeSetId.birdWingDirection, 'Wing Motion'],
		]);
		sections.unshift({
			title: 'Attitude', buttonText: 'Change',
			buttonFunc: (event:MouseEvent) => {
				event.target?.dispatchEvent(createUpdateEvent({
					func: (ui, el) => {
						let selectors = el.querySelectorAll('.attitude-select');
						ui.part.attitudes = [];
						for(let select of selectors) {
							ui.part.attitudes.push(parseInt((select as HTMLSelectElement).value));
						}
						return true;
					},
				}));
			},
			contentRows: uiState.part.device.attitudeSets.map((set, setIdx) => `
				<label>${attitudeSetLabelMap.get(set.id)}:</label>
					<select class="attitude-select">
					${set.options.map(attitudeId => `
						<option value="${attitudeId}"${uiState.part.attitudes[setIdx] == attitudeId ? ' selected' : ''}>
							${attitudeNames.get(attitudeId)}
						</option>
					`).join('\n')}
				</select>
			`),
			setUpListeners: (el: HTMLElement) => {},
		});
	}
	// device / escutcheon section
	let deviceArray = [...DEVICE.values()];
	if(uiState.part.device.type == DeviceType.escutcheon) {
		let escutcheons = deviceArray.filter(d => d.type == DeviceType.escutcheon);
		sections.unshift({
			title: 'Escutcheon', buttonText: 'Change',
			buttonFunc: (event:MouseEvent) => {
				event.target?.dispatchEvent(createUpdateEvent({
					func: (ui, el) => {
						let selector = el.querySelector('.escutcheon-type-select') as HTMLSelectElement;
						let deviceId = parseInt(selector.value);
						if(ui.part.device.id != deviceId) {
							ui.part.updateDevice(DEVICE.get(deviceId)!);
						}
						return true;
					},
				}));
			},
			contentRows: [
				`
					<label>Type:</label>
					<select class="escutcheon-type-select">
					${escutcheons.map(device => `
						<option value="${device.id}"${uiState.part.device.id == device.id ? ' selected' : ''}>
							${deviceNames.get(device.id)}
						</option>
					`).join('\n')}
					</select>
				`,
			],
			setUpListeners: (el: HTMLElement) => {},
		});
	} else if(uiState.part.device.type != DeviceType.subdivision) {
		let chargesByType = [
			deviceArray.filter(d => d.type == DeviceType.ordinary),
			deviceArray.filter(d => d.type == DeviceType.mobileCharge),
			deviceArray.filter(d => d.type == DeviceType.beast),
		];
		let chargesOfSameType = chargesByType[uiState.selectedChargeClassIndex];
		sections.unshift({
			title: 'Device', buttonText: 'Change',
			buttonFunc: (event:MouseEvent) => {
				event.target?.dispatchEvent(createUpdateEvent({
					func: (ui, el) => {
						let chargeSelect = el.querySelector('.charge-select') as HTMLSelectElement;
						let deviceId = parseInt(chargeSelect.value);
						let lineSelect = el.querySelector('.line-select') as HTMLSelectElement;
						ui.part.line = lineSelect ? parseInt(lineSelect.value) : DivisionLine.straight;
						let degreeNumberInput = el.querySelector('.degree-number-input') as HTMLInputElement;
						ui.part.chargeDegree = degreeNumberInput ? parseInt(degreeNumberInput.value) : 1;
						let numberInput = el.querySelector('.device-number-input') as HTMLInputElement;
						let number = numberInput ? parseInt(numberInput.value) : 1;
						ui.part.parent!.updateMobileChargeGroupDeviceAndNumber(ui.part, DEVICE.get(deviceId)!, number);
						return true;
					},
				}));
			},
			contentRows: [
				`
					<label>Class:</label>
					<select class="charge-class-select">
					${['Ordinary', 'Common', 'Beast'].map((label, idx) => `
						<option value="${idx}"${uiState.selectedChargeClassIndex == idx ? ' selected' : ''}>${label}</option>
					`).join('\n')}
					</select>
				`,
				`
					<label>Charge:</label>
					<select class="charge-select">
					${chargesOfSameType.map(charge => `
						<option value="${charge.id}"${uiState.selectedCharge == charge.id ? ' selected' : ''}>
							${deviceNames.get(charge.id)}
						</option>
					`).join('\n')}
					</select>
					${uiState.selectedChargeClassIndex == 1 && uiState.selectedCharge == DeviceId.mullet ? `
						of
						<input class="degree-number-input" type="number" style="width:2.5em;"
							min="5" value="${Math.max(5, uiState.part.chargeDegree)}"
						/>
					` : ''}
				`,
				uiState.selectedChargeClassIndex != 0 ? `
					<label>Number:</label>
					<input class="device-number-input" type="number" style="width:3.5em;"
						min="1" value="${(uiState.additionalCollapsedParts?.length ?? 0)+1}"
					/>
				` : `
					<label>Line:</label>
					<select class="line-select">
					${[
						DivisionLine.straight, DivisionLine.indented, DivisionLine.wavy,
						DivisionLine.embattled, DivisionLine.engrailed, DivisionLine.invected,
					].map(div => `
						<option value="${div}"${uiState.part.line == div ? ' selected' : ''}>${lineNames.get(div)}</option>
					`).join('\n')}
					</select>
				`,
			],
			setUpListeners: (el: HTMLElement) => {
				(el.querySelector('.charge-class-select') as HTMLSelectElement).onchange = event => {
					event.target?.dispatchEvent(createUpdateEvent({
						func: (ui, e) => {
							let select = e.querySelector('.charge-class-select');
							ui.selectedChargeClassIndex = parseInt((select as HTMLSelectElement).value);
							return false;
						},
					}));
				};
				(el.querySelector('.charge-select') as HTMLSelectElement).onchange = event => {
					event.target?.dispatchEvent(createUpdateEvent({
						func: (ui, e) => {
							let select = e.querySelector('.charge-select');
							ui.selectedCharge = parseInt((select as HTMLSelectElement).value);
							return false;
						},
					}));
				};
			},
		});
	}
	// features section
	let tinctureOptions = [
		Tincture.or, Tincture.argent, Tincture.azure, Tincture.gules, Tincture.sable,
		Tincture.vert, Tincture.purpure, Tincture.ermine, Tincture.vair,
	];
	if(uiState.part.device.children?.length) {
		let featuresByRow: Device[][] = [[], [], []];
		let overflowCount = uiState.part.device.children.length - 3;
		let toAssign = [...uiState.part.device.children];
		while(toAssign.length) {
			let rowIdx = featuresByRow.findIndex(r => !r.length);
			let row = featuresByRow[rowIdx];
			row.push(toAssign.shift()!);
			if(overflowCount > 2 - rowIdx) {
				row.push(toAssign.shift()!);
				overflowCount--;
			}
		}
		sections.push({
			title: 'Charge Features', buttonText: 'Tint',
			buttonFunc: (event:MouseEvent) => {
				event.target?.dispatchEvent(createUpdateEvent({
					func: (ui, el) => {
						let selectors = el.querySelectorAll('.feature-tincture-select');
						ui.part.featureTinctures = [];
						for(let select of selectors) {
							ui.part.featureTinctures.push(parseInt((select as HTMLSelectElement).value));
						}
						return true;
					},
				}));
			},
			contentRows: featuresByRow.map(features => features.map(feature => `
				<label>${deviceNames.get(feature.id)}:</label>
					<select class="feature-tincture-select"${features.length > 1 ? ' style="width:3.6em;"' : ''}>
					${tinctureOptions.map(t => `
						<option value="${t}"${
							(uiState.part.featureTinctures[uiState.part.device.children!.indexOf(feature)] ??
								uiState.part.field.tincture
							) == t ? ' selected' : ''
						}>${tinctureNames.get(t)}</option>
					`).join('\n')}
				</select>
			`).join('\n')),
			setUpListeners: (el: HTMLElement) => {},
		});
	}
	// field section
	if(uiState.part.division.type == DivisionType.none) {
		let workingField = uiState.inProgressField;
		let nonPlain = workingField.variation != FieldVariation.plain;
		sections.push({
			title: 'Field', buttonText: 'Tint',
			buttonFunc: (event:MouseEvent) => {
				event.target?.dispatchEvent(createUpdateEvent({
					func: (ui, el) => {
						ui.part.field = getFieldFromUI(el);
						return true;
					},
				}));
			},
			contentRows: [
				`
					<label>Variation:</label>
					<select class="field-variation-select">
					${[
						FieldVariation.plain, FieldVariation.barry, FieldVariation.paly, FieldVariation.bendy,
						FieldVariation.bendySinister, FieldVariation.chequy, FieldVariation.lozengy,
					].map(v => `
						<option value="${v}"${workingField.variation == v ? ' selected' : ''}>
							${fieldVariationNames.get(v)}
						</option>
					`).join('\n')}
					</select>
				`,
				`
					<label>Tincture${nonPlain ? 's' : ''}:</label>
					<select class="field-tincture-select">
					${tinctureOptions.map(t => `
						<option value="${t}"${workingField.tincture == t ? ' selected' : ''}>${tinctureNames.get(t)}</option>
					`).join('\n')}
					</select>
					${nonPlain ? `
						<select class="field-tincture-secondary-select">
						${tinctureOptions.map(t => `
							<option value="${t}"${workingField.tinctureSecondary == t ? ' selected' : ''}>
								${tinctureNames.get(t)}
							</option>
						`).join('\n')}
						</select>
					` : ''}
				`,
				...(nonPlain ? [`
					<label>Number:</label>
					<input class="field-number-input" type="number" style="width:2.5em;"
						min="2" value="${workingField.number}"
					/>
					${![FieldVariation.chequy, FieldVariation.lozengy].includes(workingField.variation) ? `
						<label>Line:</label>
						<select class="field-line-select">
						${[
							DivisionLine.straight, DivisionLine.indented, DivisionLine.wavy, DivisionLine.embattled,
						].map(line => `
							<option value="${line}"${workingField.variationLine == line ? ' selected' : ''}>
								${lineNames.get(line)}
							</option>
						`).join('\n')}
						</select>
					` : ''}
				`] : []),
			],
			setUpListeners: (el: HTMLElement) => {
				(el.querySelector('.field-variation-select') as HTMLSelectElement).onchange = event => {
					event.target?.dispatchEvent(createUpdateEvent({
						func: (ui, e) => {
							ui.inProgressField = getFieldFromUI(e);
							return false;
						},
					}));
				};
			},
		});
	}
	if(uiState.part.charges.filter(c => [DeviceType.mobileCharge, DeviceType.beast].includes(c.device.type)).length > 1) {
		sections.push({
			title: 'Charge Arrangement', buttonText: 'Arrange',
			buttonFunc: (event:MouseEvent) => {
				event.target?.dispatchEvent(createUpdateEvent({
					func: (ui, el) => {
						let select = el.querySelector('.arrangement-select');
						let rowInput = el.querySelector('.number-per-row-input') as HTMLInputElement;
						let counts = rowInput ? rowInput.value.split(',').map(s => parseInt(s)).filter(n => !isNaN(n)) : [];
						ui.part.updateChargeArrangement(parseInt((select as HTMLSelectElement).value), counts);
						return true;
					},
				}));
			},
			contentRows: [
				`
					<label>Arrangement:</label>
					<select class="arrangement-select">
					${[
						ChargeArrangement.unspecified, ChargeArrangement.specified, ChargeArrangement.inBend,
						ChargeArrangement.inBendSinister, ChargeArrangement.inChevron,
						ChargeArrangement.inChevronInverted, ChargeArrangement.inCross, ChargeArrangement.inFess,
						ChargeArrangement.inPale, ChargeArrangement.inSaltire,
					].map(arr => `
						<option value="${arr}"${uiState.selectedChargeArrangement == arr ? ' selected' : ''}>
							${arrangementNames.get(arr)}
						</option>
					`).join('\n')}
					</select>
				`,
				...(uiState.selectedChargeArrangement == ChargeArrangement.specified ? [`
					<label>Charge Counts:</label>
					<input class="number-per-row-input" type="text" style="width:6em;"
						value="${uiState.part.chargeCountByRow.join(', ')}"
					/>
				`] : []),
			],
			setUpListeners: (el: HTMLElement) => {
				(el.querySelector('.arrangement-select') as HTMLSelectElement).onchange = event => {
					event.target?.dispatchEvent(createUpdateEvent({
						func: (ui, e) => {
							let select = e.querySelector('.arrangement-select');
							ui.selectedChargeArrangement = parseInt((select as HTMLSelectElement).value);
							return false;
						},
					}));
				};
			},
		});
	}
	// add sections to document
	for(let section of sections) {
		let idx = sections.indexOf(section);
		let el = inflate(`
			<div class="editor-section" style="
				width:16em; text-align:center; border:.1em solid;
				margin-left:.5em; padding:.25em .5em;
				display:flex; flex-direction:column;
			">
				<div style="font-size:1.12em; font-weight:bold;">${section.title}</div>
				<div style="border-bottom:solid .1em;"></div>
				<div style="flex-grow:1; display:flex; flex-direction:column; justify-content:center;">
					${section.contentRows.map(contentRow => `
						<div style="margin:.16em 0;">${contentRow}</div>
					`).join('\n')}
				</div>
				<button disabled>${section.buttonText}</button>
			</div>
		`);
		let btn = el.querySelector('button')!;
		btn.onclick = e => {
			uiState.updatedEditorIndex = null;
			section.buttonFunc(e);
		};
		const updateForEditing = () => {
			btn.removeAttribute('disabled');
			el.style.borderStyle = 'dashed';
			uiState.updatedEditorIndex = idx;
		};
		if(uiState.updatedEditorIndex == idx) {
			updateForEditing();
		}
		[...el.querySelectorAll('select'),...el.querySelectorAll('input')]
			.forEach(pt => pt.addEventListener('input', updateForEditing))
		;
		([...el.querySelectorAll('.checkbox')] as HTMLElement[]).forEach(pt => pt.addEventListener('click', updateForEditing));
		section.setUpListeners(el);
		row.appendChild(el);
	}
}

function updateEditor(editor: HTMLElement, part: Part) {
	let data = (editor as any).arms as EditorUIState;
	let newEditor = getEditor(part, data.additionalCollapsedParts);
	editor.parentNode?.replaceChild(newEditor, editor);
	if(!part.parent) {
		mainEditor = newEditor;
	}
}

function updateShield() {
	let svg = inflate(getSvg(calcShieldElements(shield)));
	svg.style.filter = 'drop-shadow(0 0 0.4em black)';
	let holder = document.getElementById('shield-holder')!;
	if(holder.children.length) {
		holder.removeChild(holder.children[0]);
	}
	holder.appendChild(svg);
	let blazon = document.getElementById('blazon-holder')!;
	blazon.innerText = blazonPart(shield);
}

function randomize() {
	shield.randomize(5);
	updateShield();
	updateEditor(mainEditor, shield);
}

function exportSVG() {
	let svgText = document.getElementById('shield-holder')!.innerHTML;
	let link = document.getElementById('download-link')! as HTMLAnchorElement;
	link.href = window.URL.createObjectURL(new Blob([svgText], { type:'image/svg+xml' }));
	link.download = 'coat-of-arms.svg';
}

let shield = new Part({ device: DEVICE.get(DeviceId.heater)! });
updateShield();
let mainEditor = getEditor(shield);
document.getElementById('editor')?.appendChild(mainEditor);
