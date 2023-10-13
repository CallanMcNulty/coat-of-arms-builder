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
	additionalCollapsedParts: Part[]|null = null;

	constructor(part: Part, additionalCollapsedParts: Part[]|null) {
		this.part = part;
		this.inProgressField = part.field.clone();
		this.inProgressDivision = part.division.clone();
		this.selectedChargeClassIndex = [
			DeviceType.ordinary, DeviceType.mobileCharge, DeviceType.beast
		].indexOf(part.device.type);
		this.selectedCharge = part.device.id;
		this.additionalCollapsedParts = additionalCollapsedParts;
	}
}

class ShieldUpdate {
	func?: (data: EditorUIState, el:HTMLElement) => boolean;
}

function groupCharges(charges: Part[]): Part[][] {
	let chargeGroups: Part[][] = [];
	for(let charge of charges) {
		let latestGroup = chargeGroups[chargeGroups.length-1];
		if(latestGroup && latestGroup[0].equals(charge)) {
			latestGroup.push(charge);
		} else {
			chargeGroups.push([charge]);
		}
	}
	return chargeGroups;
}

function getEditor(part: Part, collapsed: Part[]|null=null): HTMLElement {
	let shieldSvg = inflate(getSvg(calcShieldElements(shield, part)));
	shieldSvg.setAttribute('viewBox', '-55 -55 110 110');
	let editor = inflate(`
		<div class="part-editor" style="padding-left:3em; color:#0007;">
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
					let chargeGroups = groupCharges(ui.part.parent!.charges);
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
	// update & add children
	let ui = new EditorUIState(part, collapsed);
	updateSingleEditor(editor, ui);
	(editor as any).arms = ui;
	editor.querySelector('.shieldHolder')?.appendChild(shieldSvg);
	for(let subdivision of part.parts) {
		editor.appendChild(getEditor(subdivision));
	}
	let chargeGroups = groupCharges(part.charges);
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
	let field = Field.createPlain(parseInt(tinctureSelect.value));
	field!.variation = parseInt(variationSelect.value);
	if(tinctureSecondarySelect) {
		field!.tinctureSecondary = parseInt(tinctureSecondarySelect.value);
	}
	if(numberInput) {
		field!.number = Math.max(0, parseInt(numberInput.value));
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
						'None', 'Pale', 'Fess', 'Bend', 'Bend Sinister',
						'Chevron', 'Chevron Reversed', 'Quarterly', 'Saltire',
					].map((label, idx) => `
						<option value="${idx}"${uiState.inProgressDivision.type == idx ? ' selected' : ''}>${label}</option>
					`).join('\n')}
					</select>
				`,
				...(uiState.inProgressDivision.type != DivisionType.none ? [`
					<label>Line:</label>
					<select class="division-line-select">
					${['Straight', 'Indented', 'Wavy', 'Embattled', 'Engrailed', 'Invected'].map((label, idx) => `
						<option value="${idx}"${uiState.inProgressDivision.line == idx ? ' selected' : ''}>${label}</option>
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
	// device / escutcheon section
	let labelMap = new Map<DeviceId, string>([
		[DeviceId.heater, 'Heater'],
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
		[DeviceId.lozenge, 'Lozenge'],
		[DeviceId.mullet, 'Mullet'],
		[DeviceId.heart, 'Heart'],
	]);
	let deviceArray = [...DEVICE.values()];
	if(uiState.part.device.type == DeviceType.escutcheon) {
		let escutcheons = deviceArray.filter(d => d.type == DeviceType.escutcheon);
		sections.unshift({
			title: 'Escutcheon', buttonText: 'Change',
			buttonFunc: (event:MouseEvent) => {},
			contentRows: [
				`
					<label>Type:</label>
					<select class="escutcheon-type-select">
					${escutcheons.map(device => `
						<option value="${device.id}"${uiState.part.device.id == device.id ? ' selected' : ''}>
							${labelMap.get(device.id)}
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
						const charges = ui.part.parent!.charges;
						let groupIndex = charges.findIndex(c => c.equals(ui.part));
						let precedingCharges = charges.filter((c,i) => i < groupIndex);
						let followingCharges = charges.filter((c,i) => i > groupIndex && !c.equals(ui.part));
						let chargeSelect = el.querySelector('.charge-select') as HTMLSelectElement;
						ui.part.device = DEVICE.get(parseInt(chargeSelect.value))!;
						let lineSelect = el.querySelector('.line-select') as HTMLSelectElement;
						ui.part.line = lineSelect ? parseInt(lineSelect.value) : DivisionLine.straight;
						let degreeNumberInput = el.querySelector('.degree-number-input') as HTMLInputElement;
						ui.part.chargeDegree = degreeNumberInput ? parseInt(degreeNumberInput.value) : 1;
						let numberInput = el.querySelector('.device-number-input') as HTMLInputElement;
						let number = numberInput ? parseInt(numberInput.value) : 1;
						let newCharges = [];
						while(newCharges.length<number) {
							newCharges.push(ui.part.clone());
						}
						ui.part.parent!.charges = [];
						let allCharges = [...precedingCharges, ...newCharges, ...followingCharges];
						for(let charge of allCharges) {
							ui.part.parent!.addCharge(charge);
						}
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
							${labelMap.get(charge.id)}
						</option>
					`).join('\n')}
					</select>
					${uiState.selectedCharge == DeviceId.mullet ? `
						of
						<input class="degree-number-input" type="number" style="width:3em;"
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
					${['Straight', 'Indented', 'Wavy', 'Embattled', 'Engrailed', 'Invected'].map((label, idx) => `
						<option value="${idx}"${uiState.part.line == idx ? ' selected' : ''}>${label}</option>
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
	// field section
	if(uiState.part.division.type == DivisionType.none) {
		let workingField = uiState.inProgressField;
		let nonPlain = workingField.variation != FieldVariation.plain;
		let tinctureOptions = ['Or', 'Argent', 'Azure', 'Gules', 'Sable', 'Vert', 'Purpure'];
		sections.push({
			title: 'Field', buttonText: 'Change',
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
					${['Plain', 'Barry', 'Paly', 'Bendy', 'Bendy Sinister', 'Chequy', 'Lozengy'].map((label, idx) => `
						<option value="${idx}"${workingField.variation == idx ? ' selected' : ''}>${label}</option>
					`).join('\n')}
					</select>
				`,
				`
					<label>Tincture${nonPlain ? 's' : ''}:</label>
					<select class="field-tincture-select">
					${tinctureOptions.map((label, idx) => `
						<option value="${idx}"${workingField.tincture == idx ? ' selected' : ''}>${label}</option>
					`).join('\n')}
					</select>
					${nonPlain ? `
						<select class="field-tincture-secondary-select">
						${tinctureOptions.map((label, idx) => `
							<option value="${idx}"${workingField.tinctureSecondary == idx ? ' selected' : ''}>
								${label}
							</option>
						`).join('\n')}
						</select>
					` : ''}
				`,
				...(nonPlain ? [`
					<label>Number:</label>
					<input class="field-number-input" type="number" style="width:3.5em;"
						min="2" value="${workingField.number}"
					/>
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
	// add sections to document
	for(let section of sections) {
		let el = inflate(`
			<div class="editor-section" style="
				width:15em; text-align:center; border:.1em solid;
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
				<button>${section.buttonText}</button>
			</div>
		`);
		el.querySelector('button')!.onclick = section.buttonFunc;
		section.setUpListeners(el);
		row.appendChild(el);
	}
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
							state.part.parent.charges[state.part.parent.charges.indexOf(p)] = state.part.clone();
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
}

function updateEditor(editor: HTMLElement, part: Part) {
	let data = (editor as any).arms as EditorUIState;
	editor.parentNode?.replaceChild(getEditor(part, data.additionalCollapsedParts), editor);
}

function updateShield() {
	let svg = inflate(getSvg(calcShieldElements(shield)));
	svg.style.filter = 'drop-shadow(0 0 0.4em black)';
	let holder = document.getElementById('shield-holder')!;
	if(holder.children.length) {
		holder.removeChild(holder.children[0]);
	}
	holder.appendChild(svg);
}

const shield = new Part({ device: DEVICE.get(DeviceId.heater)! });
shield.divide(new Division(DivisionType.fess, DivisionLine.wavy));
shield.parts[0].chargeArrangement = ChargeArrangement.crosswise;
shield.parts[0].field = Field.createPlain(Tincture.sable);
for(let c=0; c<6; c++) {
	let fld = Field.createPlain(Tincture.gules);
	shield.parts[0].addCharge(new Part({ device: DEVICE.get(DeviceId.heart)!, field: fld }));
}
shield.parts[1].field = Field.createPlain(Tincture.or);
// shield.parts[1].chargeArrangement = ChargeArrangement.chevronwiseReversed;
// for(let c=0; c<5; c++) {
// 	shield.parts[1].addCharge(
// 		new Part({ device: DEVICE.get(DeviceId.roundel)!, field:Field.createPlain(Tincture.azure) })
// 	);
// }
updateShield();
let mainEditor = getEditor(shield);
document.getElementById('editor')?.appendChild(mainEditor);
