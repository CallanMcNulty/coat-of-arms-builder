const scope = new paper.PaperScope();
scope.setup(new paper.Size(100, 100));

type PathData = {
	id?: string;
	path?: string|null;
	color?: string;
	pattern?: string;
	line?: boolean;
	lineWeight?: number;
	opacity?: number;
};

const colorMap = new Map([
	[ Tincture.argent, '#f6f5e9' ],
	[ Tincture.azure, '#203388' ],
	[ Tincture.gules, '#ca271c' ],
	[ Tincture.or, '#e4ae0c' ],
	[ Tincture.purpure, '#893d8f' ],
	[ Tincture.sable, '#171826' ],
	[ Tincture.vert, '#20801e' ],
]);

function getPathForPart(part: Part, box: paper.Rectangle): paper.Path {
	const dev = part.device;
	let path = null;
	switch(dev.id) {
		case DeviceId.heater:
			path = new paper.Path([
				new paper.Segment(new paper.Point(-45, -20), new paper.Point(0, 50)),
				new paper.Segment(new paper.Point(-45, -50)),
				new paper.Segment(new paper.Point(45, -50),),
				new paper.Segment(new paper.Point(45, -20), undefined, new paper.Point(0, 50)),
				new paper.Segment(new paper.Point(0, 50)),
			]);
			path.closePath();
			break;
		case DeviceId.lozenge:
			let halfWidth = box.height * .4;
			path = new paper.Path([
				new paper.Point(box.center.x, box.point.y),
				new paper.Point(box.center.x - halfWidth, box.center.y),
				new paper.Point(box.center.x, box.bottom),
				new paper.Point(box.center.x + halfWidth, box.center.y),
			]);
			path.closePath();
			break;
		case DeviceId.mullet:
			const pointCount = 5;
			let angle = 360 / pointCount;
			let points = [];
			for(let i=0; i<pointCount; i++) {
				let pt = new paper.Point(box.center.x, box.top);
				points.push(pt.rotate(angle * i, box.center));
			}
			const pointConnection = Math.ceil(pointCount/2) - 1;
			let lines: paper.Path.Line[][] = [];
			let incIndexForwardAndBack = (idx: number, amount: number) => {
				let previousPointIdx = idx - amount;
				if(previousPointIdx < 0) {
					previousPointIdx += pointCount;
				}
				let nextPointIdx = (idx + amount) % pointCount;
				return [previousPointIdx, nextPointIdx];
			}
			for(let i=0; i<pointCount; i++) {
				let [previousPointIdx, nextPointIdx] = incIndexForwardAndBack(i, pointConnection);
				lines.push([
					new paper.Path.Line(points[i], points[previousPointIdx]),
					new paper.Path.Line(points[i], points[nextPointIdx]),
				]);
			}
			let starPoints = [];
			for(let i=0; i<pointCount; i++) {
				let adjacentPoints = incIndexForwardAndBack(i, 1);
				let currentLines = lines[i];
				let adjacentLines = adjacentPoints.map(idx => lines[idx]);
				let priorAdjacent = currentLines[0].getCrossings(adjacentLines[0][1]).pop()!.point;
				let nextAdjacent = currentLines[1].getCrossings(adjacentLines[1][0]).pop()!.point;
				starPoints.push(priorAdjacent, points[i], nextAdjacent);
			}
			path = new paper.Path(starPoints);
			path.closePath();
			break;
		case DeviceId.heart:
			path = new paper.Path([
				new paper.Segment(
					new paper.Point(box.center.x, box.bottom),
					new paper.Point(box.width, -box.height*.6),
					new paper.Point(-box.width, -box.height*.6),
				),
				new paper.Segment(
					new paper.Point(box.center.x, box.top + box.height*.3),
					new paper.Point(-box.width*.2, -box.height*.4),
					new paper.Point(box.width*.2, -box.height*.4),
				),
			]);
			path.closePath();
			break;
		default:
			path = new paper.Path.Circle(box.center, box.width/2);
			break;
	}
	path?.fitBounds(box);
	return path!;
}

function getFessPointForDevice(device: Device, path: paper.Path): paper.Point {
	switch(device.id) {
		case DeviceId.heater:
			return new paper.Point(.5, .43);
		default:
			let box: any = path.bounds;
			let coords = ['x','y'].map(coord => {
				let measure = coord == 'x' ? 'width' : 'height';
				let upperBound = 1;
				let lowerBound = 0;
				let workingCoord = 0;
				for(let i=0; i<20; i++) {
					workingCoord = upperBound + (lowerBound - upperBound) * .5;
					let divisions = dividePath(path,
						coord == 'x' ? Division.pale : Division.fess,
						new paper.Point(workingCoord, workingCoord),
					);
					let areas = divisions.map(div => (div as paper.Path).area);
					let difference = areas[1] - areas[0];
					if(Math.abs(difference) < box[measure]*.05) {
						break;
					}
					if(difference < 0) {
						lowerBound = workingCoord;
					} else {
						upperBound = workingCoord;
					}
				}
				return workingCoord;
			});
			return new paper.Point(coords[0], coords[1]);
	}
}

function getIntersectionPathForDivision(path: paper.Path, fessPointRatio: paper.Point, division: Division): paper.Path {
	let box = path.bounds;
	let fessPoint = new paper.Point(
		box.x + box.width * fessPointRatio.x,
		box.y + box.height * fessPointRatio.y,
	);
	switch(division) {
		case Division.pale: {
			return new paper.Path.Rectangle(
				new paper.Rectangle(new paper.Point(fessPoint.x, -1000), new paper.Size(2000, 2000))
			);
		}
		case Division.fess: {
			return new paper.Path.Rectangle(
				new paper.Rectangle(new paper.Point(-1000, fessPoint.y), new paper.Size(2000, 2000))
			);
		}
		case Division.bend: {
			return new paper.Path([
				new paper.Point(fessPoint.x + 1000, fessPoint.y + 1000),
				new paper.Point(fessPoint.x - 1000, fessPoint.y - 1000),
				new paper.Point(-1000, -1000), new paper.Point(1000, -1000), new paper.Point(1000, 1000),
			]);
		}
		case Division.bendSinister: {
			return new paper.Path([
				new paper.Point(fessPoint.x - 1000, fessPoint.y + 1000),
				new paper.Point(fessPoint.x + 1000, fessPoint.y - 1000),
				new paper.Point(-1000, -1000), new paper.Point(1000, -1000), new paper.Point(1000, 1000),
			]);
		}
		case Division.chevron: {
			let midpoint = fessPoint.y - fessPointRatio.y*box.height*.3;
			return new paper.Path([
				new paper.Point(fessPoint.x - 1000, midpoint + 1000),
				new paper.Point(fessPoint.x, midpoint),
				new paper.Point(fessPoint.x + 1000, midpoint + 1000),
				new paper.Point(1000, -1000), new paper.Point(-1000, -1000),
			]);
		}
		case Division.chevronReversed: {
			let midpoint = fessPoint.y + (1 - fessPointRatio.y)*box.height*.3;
			return new paper.Path([
				new paper.Point(fessPoint.x - 1000, midpoint - 1000),
				new paper.Point(fessPoint.x, midpoint),
				new paper.Point(fessPoint.x + 1000, midpoint - 1000),
				new paper.Point(1000, -1000), new paper.Point(-1000, -1000),
			]);
		}
		default:
			throw new Error(`No intersection path for division ${division}`);
	}
}

function dividePath(path: paper.Path, division: Division, fessPointRatio: paper.Point, line: boolean=false): paper.Path[] {
	if([Division.saltire, Division.quarterly].includes(division)) {
		let sections = division == Division.saltire ? [Division.bend, Division.bendSinister] : [Division.fess, Division.pale];
		let intersections = sections.map(s => getIntersectionPathForDivision(path, fessPointRatio, s));
		if(line) {
			let lines = intersections.map(i => i.intersect(path, {trace:false})) as paper.Path[];
			let divider = getIntersectionPathForDivision(
				path, fessPointRatio, division == Division.saltire ? Division.pale : Division.bend
			);
			let linesToSplit = division == Division.saltire ? lines : [lines[1]];
			let splitLines = linesToSplit.flatMap(l => [
				l.intersect(divider, {trace:false}), l.subtract(divider, {trace:false})
			] as paper.Path[]);
			if(division == Division.quarterly) {
				splitLines.push(lines[0]);
			}
			return splitLines;
		}
		let verticalHalves = [path.intersect(intersections[0]), path.subtract(intersections[0])] as paper.Path[];
		return verticalHalves.flatMap(h => [h.intersect(intersections[1]), h.subtract(intersections[1])]) as paper.Path[];
	} else {
		const intersectionPath = getIntersectionPathForDivision(path, fessPointRatio, division);
		if(!line) {
			intersectionPath.closePath();
			return [path.intersect(intersectionPath), path.subtract(intersectionPath)] as paper.Path[];
		} else {
			let divisionLine = intersectionPath.intersect(path, {trace:false}) as paper.Path;
			if([Division.chevron, Division.chevronReversed].includes(division)) {
				let paleIntersection = getIntersectionPathForDivision(path, fessPointRatio, Division.pale);
				return [
					divisionLine.intersect(paleIntersection, {trace:false}),
					divisionLine.subtract(paleIntersection, {trace:false}),
				] as paper.Path[];
			}
			return [divisionLine] as paper.Path[];
		}
	}
}

function calcShieldPart(part: Part, path: paper.Path, targetPart: Part|null=null): PathData[] {
	let paths: PathData[] = [];
	let fessPoint = getFessPointForDevice(part.device, path);
	// divisions / field
	if(part.division != Division.none) {
		let subdivisions = dividePath(path, part.division, fessPoint);
		if(part == targetPart) {
			paths.push({ path:path?.pathData, color:'wheat' });
			return paths;
		}
		paths.push(...part.parts.flatMap((p, i) => calcShieldPart(p, subdivisions[i], targetPart)));
		// let lines = dividePath(path, part.division, fessPoint, true);
		// paths.push(...lines.flatMap(line => ({path:line.pathData, color:'grey', line:true})));
	} else {
		if(!targetPart || part == targetPart) {
			paths.push({ path:path?.pathData, color:colorMap.get(part.field.tincture) });
			if(part.field.variation != FieldVariation.plain) {
				let corner = path.bounds.topLeft;
				let rotation = 0;
				if(part.field.variation == FieldVariation.paly) {
					rotation = 90;
				}
				if(part.field.variation == FieldVariation.chequy) {
					rotation = -90;
				}
				if(part.field.variation == FieldVariation.bendySinister) {
					rotation = 45;
				}
				if([FieldVariation.bendy, FieldVariation.lozengy].includes(part.field.variation)) {
					rotation = -45;
				}
				if(rotation) {
					path.rotate(rotation, corner);
				}
				let bars: paper.Path[] = [];
				let barPortion = 1 / part.field.number;
				let barSize = path.bounds.height / part.field.number;
				let orthogonalBars: paper.Path[] = [];
				let orth = path.clone();
				for(
					let div = new paper.Path.Rectangle(
						new paper.Rectangle(new paper.Point(path.bounds.x+barSize, -1000), new paper.Size(1000,2000))
					);
					div.bounds.x-barSize<path.bounds.right;
					div.translate(new paper.Point(barSize, 0))
				) {
					orthogonalBars.push(orth.subtract(div) as paper.Path);
					orth = orth.intersect(div) as paper.Path;
				}
				for(let i=0; i<part.field.number; i++) {
					let divider = getIntersectionPathForDivision(path, new paper.Point(.5, barPortion * i), Division.fess);
					let bar = path.intersect(divider);
					divider.translate(new paper.Point(0, barSize));
					bar = bar.subtract(divider);
					let oddRow = i%2 == 1;
					if([FieldVariation.lozengy, FieldVariation.chequy].includes(part.field.variation)) {
						for(let [j,orth] of orthogonalBars.entries()) {
							let oddCol = j%2 == 1;
							if(oddRow == oddCol) {
								bars.push(bar.intersect(orth) as paper.Path);
							}
						}
					} else if(oddRow) {
						bars.push(bar as paper.Path);
					}
				}
				if(rotation) {
					path.rotate(-rotation, corner);
					bars.forEach(b => b.rotate(-rotation, corner));
				}
				paths.push(...bars.map(b => ({ path:b.pathData, color:colorMap.get(part.field.tinctureSecondary!) })));
			}
		}
		if(part == targetPart) {
			return paths;
		}
	}
	// mobile charges
	let mobileCharges = part.charges.filter(c => c.device.type == DeviceType.mobileCharge || c.device.type == DeviceType.beast);
	if(mobileCharges.length) {
		let minChargeSeparation: number = Infinity;
		let lines: paper.Path[] = [];
		let chargesPerLine: number[] = [mobileCharges.length];
		let getLinesByCount = (count:number): [paper.Path[], number] => {
			let lineHeight = 1 / (count + 1);
			let result = [];
			for(let i=0; i<count; i++) {
				let dividingLine = dividePath(path, Division.fess, new paper.Point(.5, (i+1)*lineHeight), true).pop();
				if(dividingLine) {
					result.push(dividingLine);
				}
			}
			return [result, lineHeight * path.bounds.height];
		};
		let distributeCharges = (chargeCount:number, lineSet: paper.Path[], existingPositions:number=0): number[] => {
			// get first approximation of how many charges go on each line, rounding down
			let totalLength = lineSet.reduce((acc,curr) => acc+curr.length, 0);
			let totalSections = chargeCount + lineSet.length - existingPositions;
			let chargesPerLineInfo = lineSet.map(l => {
				let expected = Math.max(1, (l.length / totalLength) * totalSections);
				return {line:l, expected:expected, actual:Math.floor(expected)};
			});
			// distribute any remaining charges to the rows with most spare space
			let distributedCharges = chargesPerLineInfo.reduce((acc,curr) => curr.actual + acc, 0);
			let toDistribute = totalSections - distributedCharges;
			chargesPerLineInfo.sort((a,b) => b.expected%1 - a.expected%1);
			for(let i=0; i<toDistribute; i++) {
				let info = chargesPerLineInfo[i];
				info.actual++;
			}
			return lineSet.map(l => chargesPerLineInfo.find(i => i.line == l)!.actual - 1);
		};
		switch(part.chargeArrangement) {
			case ChargeArrangement.specified: {
				chargesPerLine = [];
				let [createdLines, lineHeight] = getLinesByCount(part.chargeCountByRow.length);
				minChargeSeparation = lineHeight;
				for(let [i, line] of createdLines.entries()) {
					if(!line.children) {
						lines.push(line);
						chargesPerLine.push(part.chargeCountByRow[i]);
					} else {
						let children = line.children as paper.Path[];
						lines.push(...children);
						chargesPerLine.push(...distributeCharges(part.chargeCountByRow[i], children));
					}
				}
				break;
			}
			case ChargeArrangement.unspecified: {
				let rowCount = Math.round(Math.sqrt(mobileCharges.length));
				let bestFactorDeviation = Infinity;
				// narrow in on number of rows that keeps horizontal and vertical charge separation as close as possible
				for(let t=0; t<20; t++) {
					let [createdLines, lineHeight] = getLinesByCount(rowCount);
					let fullLength = createdLines.reduce((acc,curr) => acc+curr.length, 0);
					let chargeSeparation = fullLength / (mobileCharges.length + rowCount);
					let params = [lineHeight, chargeSeparation].sort((a,b) => a-b);
					let factor = params[1] / params[0];
					let factorDeviation = Math.abs(factor-1);
					if(factorDeviation > bestFactorDeviation) {
						break;
					}
					bestFactorDeviation = factorDeviation;
					lines = createdLines.flatMap(l => l.children as paper.Path[] ?? [l]);
					minChargeSeparation = params[0];
					if(factor >= 2) {
						if(lineHeight < chargeSeparation) {
							factor = 1/factor;
						}
						rowCount = Math.round(rowCount * factor);
					} else {
						if(lineHeight < chargeSeparation) {
							rowCount--;
						} else {
							rowCount++;
						}
					}
				}
				break;
			}
			case ChargeArrangement.fesswise:
				lines = dividePath(path, Division.fess, fessPoint, true);
				break;
			case ChargeArrangement.palewise:
				lines = dividePath(path, Division.pale, fessPoint, true);
				break;
			case ChargeArrangement.bendwise:
				lines = dividePath(path, Division.bend, fessPoint, true);
				break;
			case ChargeArrangement.bendwiseSinister:
				lines = dividePath(path, Division.bendSinister, fessPoint, true);
				break;
			case ChargeArrangement.chevronwise:
				lines = dividePath(path, Division.chevron, fessPoint, true);
				break;
			case ChargeArrangement.chevronwiseReversed:
				lines = dividePath(path, Division.chevronReversed, fessPoint, true);
				break;
			case ChargeArrangement.crosswise:
				lines = dividePath(path, Division.quarterly, fessPoint, true);
				break;
			case ChargeArrangement.saltirewise:
				lines = dividePath(path, Division.saltire, fessPoint, true);
				break;
		}
		if(lines.length) {
			let chargePositions: paper.Point[] = [];
			// find charge separation if not already set
			if(minChargeSeparation == Infinity) {
				minChargeSeparation = Math.min(
					minChargeSeparation,
					lines.reduce((acc,curr) => acc+curr.length, 0) / mobileCharges.length
				);
			}
			if(chargesPerLine.length < lines.length) {
				// check for a center point
				if(mobileCharges.length % 2 == 1 && part.chargeArrangement != ChargeArrangement.crosswise) {
					let endpoints = lines.flatMap(l => [l.segments[0], l.segments[l.segments.length-1]].map(s => s.point));
					let endpointCounts: {ep:paper.Point, count:number}[] = [];
					for(let endpoint of endpoints) {
						let count = endpointCounts.find(ct => {
							let dist = ['x','y'].map(c => Math.abs((ct.ep as any)[c] - (endpoint as any)[c]) < .0001);
							return dist[0] && dist[1];
						});
						if(!count) {
							count = {ep:endpoint, count:0};
							endpointCounts.push(count);
						}
						count.count++;
					}
					let greatestCount = endpointCounts.sort((a,b) => a.count - b.count).pop()!;
					if(greatestCount.count > 1) {
						chargePositions.push(greatestCount.ep);
					}
				}
				chargesPerLine = distributeCharges(mobileCharges.length, lines, chargePositions.length);
			}
			// calculate positions
			for(let [lineIdx, line] of lines.entries()) {
				let chargeCount = chargesPerLine[lineIdx];
				let chargeSeparation = line.length / (chargeCount+1);
				if(chargeSeparation < minChargeSeparation) {
					minChargeSeparation = chargeSeparation;
				}
				for(let i=0; i<chargeCount; i++) {
					chargePositions.push(line.getPointAt(chargeSeparation * (i+1)));
				}
			}
			// get paths
			let chargeSize = minChargeSeparation * .8;
			for(let [chargeIdx, charge] of mobileCharges.entries()) {
				let pos = chargePositions[chargeIdx];
				let chargePath = getPathForPart(charge,
					new paper.Rectangle(
						new paper.Point(pos.x - chargeSize/2, pos.y - chargeSize/2),
						new paper.Size(chargeSize, chargeSize),
					),
				);
				paths.push(...calcShieldPart(charge, path.intersect(chargePath) as paper.Path, targetPart));
			}
		}
	}
	return paths;
}

function calcShieldElements(shield: Part, targetPart: Part|null=null): PathData[] {
	let basePath = getPathForPart(shield, new paper.Rectangle(new paper.Point(-50, -50), new paper.Size(100, 100)));
	let result = calcShieldPart(shield, basePath, targetPart);
	scope.project.clear();
	return result;
}
