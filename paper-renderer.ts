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
	[ Tincture.azure, '#273ea5' ],
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
			const pointCount = part.chargeDegree;
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
	let box: any = path.bounds;
	let ratio;
	switch(device.id) {
		case DeviceId.heater:
			ratio = new paper.Point(.5, .44);
			break;
		default:
			let coords = ['x','y'].map(coord => {
				let measure = coord == 'x' ? 'width' : 'height';
				let upperBound = box[coord] + box[measure];
				let lowerBound = box[coord];
				let workingCoord = lowerBound;
				for(let i=0; i<20; i++) {
					workingCoord = upperBound + (lowerBound - upperBound) * .5;
					let divisions = dividePath(path,
						new Division(coord == 'x' ? DivisionType.pale : DivisionType.fess, DivisionLine.straight),
						new paper.Point(workingCoord, workingCoord),
					);
					let areas = divisions.map(div => (div as paper.Path).area);
					let difference = areas[0] - areas[1];
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
	return new paper.Point(box.x + ratio.x * box.width, box.y + ratio.y * box.height);
}

function getIntersectionPathForDivision(path: paper.Path, fessPoint: paper.Point, division: Division): paper.Path {
	let box = path.bounds;
	let lineSegments = [];
	let inProgressPath: paper.Path|null = null;
	if(division.line != DivisionLine.straight) {
		let approxFinalLength = Math.min(box.width, box.height);
		let paramMap = new Map<DivisionLine, {reps:number, orth:number}>([
			[DivisionLine.indented, {reps:12, orth:.5}],
			[DivisionLine.wavy, {reps:6, orth:.15}],
			[DivisionLine.embattled, {reps:10, orth:.3}],
			[DivisionLine.engrailed, {reps:7, orth:1.1}],
			[DivisionLine.invected, {reps:7, orth:1.1}],
		]);
		let params = paramMap.get(division.line)!;
		let inc = approxFinalLength / params.reps;
		let steps = Math.ceil(200 / inc);
		let workingY = fessPoint.y - inc * steps;
		for(let i=0; i<steps*2; i++) {
			workingY += inc;
			if(division.line == DivisionLine.embattled) {
				let dirs = [-1, 1];
				if(i%2 == 0) {
					dirs.reverse();
				}
				lineSegments.push(...dirs.map(dir => new paper.Segment(
					new paper.Point(dir * inc * params.orth, workingY + .5*inc)
				)));
			} else if([DivisionLine.indented, DivisionLine.wavy].includes(division.line)) {
				let x = fessPoint.x + (i%2 == 0 ? -1 : 1) * inc * params.orth;
				lineSegments.push(new paper.Segment(
					new paper.Point(x, workingY),
					...(division.line == DivisionLine.wavy ? [new paper.Point(0, -inc*.5), new paper.Point(0, inc*.5)] : []),
				));
			} else if([DivisionLine.engrailed, DivisionLine.invected].includes(division.line)) {
				let circ = new paper.Path.Circle(new paper.Point(fessPoint.x, workingY), inc * params.orth * .5)
				if(!inProgressPath) {
					inProgressPath = circ;
				} else {
					inProgressPath = circ.unite(inProgressPath) as paper.Path;
				}
			}
		}
	}
	if(!lineSegments.length) {
		lineSegments.push(
			new paper.Segment(new paper.Point(fessPoint.x, fessPoint.y + 200)),
			new paper.Segment(new paper.Point(fessPoint.x, fessPoint.y - 200)),
		);
	}
	lineSegments.push(
		new paper.Segment(new paper.Point(fessPoint.x - 200, fessPoint.y - 200)),
		new paper.Segment(new paper.Point(fessPoint.x - 200, fessPoint.y + 200)),
	);
	let divisionPath = new paper.Path(lineSegments);
	let engrailOffset = (inProgressPath?.bounds.width ?? 0)/3;
	if(DivisionLine.engrailed == division.line) {
		divisionPath = divisionPath.unite(inProgressPath!) as paper.Path;
		engrailOffset *= -1;
	} else if(DivisionLine.invected == division.line) {
		divisionPath = divisionPath.subtract(inProgressPath!) as paper.Path;
	} else {
		engrailOffset = 0;
	}
	switch(division.type) {
		case DivisionType.pale:
			divisionPath.scale(1, -1);
			break;
		case DivisionType.fess:
			divisionPath.rotate(90, fessPoint);
			break;
		case DivisionType.bend:
			divisionPath.rotate(135, fessPoint);
			break;
		case DivisionType.bendSinister:
			divisionPath.rotate(45, fessPoint);
			break;
		default:
			throw new Error(`No intersection path for division ${division}`);
	}
	if(engrailOffset) {
		divisionPath.translate(new paper.Point(0, engrailOffset * Math.SQRT1_2));
	}
	return divisionPath;
}

function getRightAnglePathForLine(path: paper.Path, fessPoint: paper.Point, line: DivisionLine, exterior:boolean): paper.Path {
	let divLine = line;
	let mirrors = [DivisionLine.engrailed, DivisionLine.invected];
	if(mirrors.includes(divLine)) {
		if(!exterior) {
			let idx = mirrors.indexOf(divLine);
			if(idx > -1) {
				mirrors.reverse();
				divLine = mirrors[idx];
			}
		}
		if(divLine == DivisionLine.invected) {
			let base = new paper.Path.Rectangle(new paper.Rectangle(new paper.Point(fessPoint.x,-200), new paper.Size(200,400)));
			let engrailed = getRightAnglePathForLine(path, fessPoint, DivisionLine.engrailed, true);
			base = base.subtract(engrailed) as paper.Path;
			let intersectionPoint = new paper.Point(fessPoint.x, engrailed.bounds.bottom);
			engrailed.scale(1, -1, intersectionPoint);
			base = base.subtract(engrailed) as paper.Path;
			base.rotate(-90, intersectionPoint);
			return base;
		}
	}
	let divisionPaths = [DivisionType.bend, DivisionType.bendSinister];
	let divisions = divisionPaths.map(d => getIntersectionPathForDivision(path, fessPoint, new Division(d, divLine)));
	let intersection = divisions[0].intersect(divisions[1]) as paper.Path;
	return intersection;
}

function dividePath(path: paper.Path, division: Division, fessPoint: paper.Point, line: boolean=false): paper.Path[] {
	if([DivisionType.saltire, DivisionType.quarterly].includes(division.type)) {
		let paleIntersection = getIntersectionPathForDivision(
			path, fessPoint, new Division(DivisionType.pale, DivisionLine.straight)
		);
		if(division.type == DivisionType.quarterly && line) {
			let fessLine = getIntersectionPathForDivision(path, fessPoint,
				new Division(DivisionType.fess, DivisionLine.straight)
			);
			return [
				fessLine.intersect(path.intersect(paleIntersection), {trace:false}),
				fessLine.intersect(path.subtract(paleIntersection), {trace:false}),
				paleIntersection.intersect(path, {trace:false}),
			] as paper.Path[];
		}
		let topRightAngleLine = getRightAnglePathForLine(path, fessPoint, division.line, true);
		let yDif = topRightAngleLine.bounds.bottom - fessPoint.y;
		topRightAngleLine.translate(new paper.Point(0, -yDif));
		let bottomRightAngleLine = topRightAngleLine.clone();
		bottomRightAngleLine.scale(1,-1,fessPoint);
		if(!line) {
			if(division.type == DivisionType.quarterly) {
				topRightAngleLine.rotate(-45, fessPoint);
				bottomRightAngleLine.rotate(-45, fessPoint);
				paleIntersection.rotate(-45, fessPoint);
			}
			let result = [
				path.intersect(topRightAngleLine),
				path.intersect(paleIntersection).subtract(topRightAngleLine).subtract(bottomRightAngleLine),
				path.subtract(paleIntersection).subtract(topRightAngleLine).subtract(bottomRightAngleLine),
				path.intersect(bottomRightAngleLine),
			] as paper.Path[];
			if(division.type == DivisionType.quarterly) {
				let toSwap = result[1];
				result[1] = result[2];
				result[2] = toSwap;
			}
			return result;
		} else {
			return [
				topRightAngleLine.intersect(path.intersect(paleIntersection), {trace:false}),
				topRightAngleLine.intersect(path.subtract(paleIntersection), {trace:false}),
			] as paper.Path[];
		}
	} else if([DivisionType.chevron, DivisionType.chevronReversed].includes(division.type)) {
		let reversed = DivisionType.chevronReversed == division.type;
		let anglePoint = fessPoint.clone();
		anglePoint.y += path.bounds.height * .18 * (reversed ? 1 : -1);
		let rightAngleLine = getRightAnglePathForLine(path, anglePoint, division.line, reversed);
		if(!reversed) {
			rightAngleLine.scale(1,-1,anglePoint);
		}
		if(!line) {
			return [path.intersect(rightAngleLine), path.subtract(rightAngleLine)] as paper.Path[];
		} else {
			rightAngleLine.scale(-1,1,anglePoint);
			let paleIntersection = getIntersectionPathForDivision(
				path, fessPoint, new Division(DivisionType.pale, DivisionLine.straight)
			);
			return [
				rightAngleLine.intersect(path.intersect(paleIntersection), {trace:false}),
				rightAngleLine.intersect(path.subtract(paleIntersection), {trace:false}),
			] as paper.Path[];
		}
	} else {
		const intersectionPath = getIntersectionPathForDivision(path, fessPoint, division);
		if(!line) {
			intersectionPath.closePath();
			return [path.intersect(intersectionPath), path.subtract(intersectionPath)] as paper.Path[];
		} else {
			return [intersectionPath.intersect(path, {trace:false})] as paper.Path[];
		}
	}
}

function calcShieldPart(part: Part, path: paper.Path, targetPart: Part|null=null): PathData[] {
	let paths: PathData[] = [];
	let fessPoint = getFessPointForDevice(part.device, path);
	// divisions / field
	if(part.division.type != DivisionType.none) {
		let subdivisions = dividePath(path, part.division, fessPoint);
		if(part == targetPart) {
			paths.push({ path:path?.pathData, color:'wheat' });
			return paths;
		}
		paths.push(...part.parts.flatMap((p, i) => calcShieldPart(p, subdivisions[i], targetPart)));
		// let lines = dividePath(path, part.division, fessPointAbsolute, true);
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
				let barSize = path.bounds.height / part.field.number;
				let orthogonalBars: paper.Path[] = [];
				let orth = path.clone();
				for(
					let div = new paper.Path.Rectangle(
						new paper.Rectangle(new paper.Point(path.bounds.x+barSize, -200), new paper.Size(200,400))
					);
					div.bounds.x-barSize < path.bounds.right;
					div.translate(new paper.Point(barSize, 0))
				) {
					orthogonalBars.push(orth.subtract(div) as paper.Path);
					orth = orth.intersect(div) as paper.Path;
				}
				let divider = getIntersectionPathForDivision(path,
					new paper.Point(fessPoint.x, path.bounds.y),
					new Division(DivisionType.fess, DivisionLine.straight),
				);
				for(let i=0; i<part.field.number; i++) {
					let bar = path.subtract(divider);
					divider.translate(new paper.Point(0, barSize));
					bar = bar.intersect(divider);
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
	let chargePathMap = new Map<Part, PathData[]>();
	let mobileCharges = part.charges.filter(c => [DeviceType.mobileCharge, DeviceType.beast].includes(c.device.type));
	if(mobileCharges.length) {
		let minChargeSeparation: number = Infinity;
		let lines: paper.Path[] = [];
		let chargesPerLine: number[] = [mobileCharges.length];
		let getLinesByCount = (count:number): [paper.Path[], number] => {
			let lineHeight = path.bounds.height / (count + 1);
			let result = [];
			for(let i=0; i<count; i++) {
				let dividingLine = dividePath(path,
					new Division(DivisionType.fess, DivisionLine.straight),
					new paper.Point(fessPoint.x, path.bounds.y + (i+1)*lineHeight),
					true,
				).pop();
				if(dividingLine) {
					result.push(dividingLine);
				}
			}
			return [result, lineHeight];
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
				lines = dividePath(path, new Division(DivisionType.fess, DivisionLine.straight), fessPoint, true);
				break;
			case ChargeArrangement.palewise:
				lines = dividePath(path, new Division(DivisionType.pale, DivisionLine.straight), fessPoint, true);
				break;
			case ChargeArrangement.bendwise:
				lines = dividePath(path, new Division(DivisionType.bend, DivisionLine.straight), fessPoint, true);
				break;
			case ChargeArrangement.bendwiseSinister:
				lines = dividePath(path, new Division(DivisionType.bendSinister, DivisionLine.straight), fessPoint, true);
				break;
			case ChargeArrangement.chevronwise:
				lines = dividePath(path, new Division(DivisionType.chevron, DivisionLine.straight), fessPoint, true);
				break;
			case ChargeArrangement.chevronwiseReversed:
				lines = dividePath(path, new Division(DivisionType.chevronReversed, DivisionLine.straight), fessPoint, true);
				break;
			case ChargeArrangement.crosswise:
				lines = dividePath(path, new Division(DivisionType.quarterly, DivisionLine.straight), fessPoint, true);
				break;
			case ChargeArrangement.saltirewise:
				lines = dividePath(path, new Division(DivisionType.saltire, DivisionLine.straight), fessPoint, true);
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
			let centerPosition = null;
			let pointEq = (a: paper.Point, b: paper.Point) => {
				let dist = ['x','y'].map(c => Math.abs((a as any)[c] - (b as any)[c]) < .0001);
				return dist[0] && dist[1]
			};
			if(chargesPerLine.length < lines.length) {
				// check for a center point
				if(mobileCharges.length % 2 == 1 && part.chargeArrangement != ChargeArrangement.crosswise) {
					let endpoints = lines.flatMap(l => [l.segments[0], l.segments[l.segments.length-1]].map(s => s.point));
					let endpointCounts: {ep:paper.Point, count:number}[] = [];
					for(let endpoint of endpoints) {
						let count = endpointCounts.find(ct => pointEq(ct.ep, endpoint));
						if(!count) {
							count = {ep:endpoint, count:0};
							endpointCounts.push(count);
						}
						count.count++;
					}
					let greatestCount = endpointCounts.sort((a,b) => a.count - b.count).pop()!;
					if(greatestCount.count > 1) {
						centerPosition = greatestCount.ep;
					}
				}
				chargesPerLine = distributeCharges(mobileCharges.length, lines, centerPosition ? 1 : 0);
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
				if(centerPosition && pointEq(centerPosition, line.segments[line.segments.length-1].point)) {
					chargePositions.push(centerPosition);
					centerPosition = null;
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
				chargePathMap.set(charge, calcShieldPart(charge, path.intersect(chargePath) as paper.Path, targetPart));
			}
		}
	}
	// ordinaries
	let ordinaries = part.charges.filter(c => c.device.type == DeviceType.ordinary);
	for(let ordinary of ordinaries) {
		let halfWidth = path.bounds.width/8;
		if([DeviceId.bend, DeviceId.bendSinister, DeviceId.fess, DeviceId.pale].includes(ordinary.device.id)) {
			let div = getIntersectionPathForDivision(path, fessPoint, new Division(DivisionType.fess, ordinary.line));
			let ord = new paper.Path.Rectangle(new paper.Rectangle(new paper.Point(-200,-200), new paper.Size(400,400)));
			div.translate(new paper.Point(0, -halfWidth));
			ord = ord.subtract(div) as paper.Path;
			if([DivisionLine.engrailed, DivisionLine.invected].includes(ordinary.line)) {
				div.rotate(180, fessPoint);
				ord = ord.subtract(div) as paper.Path;
			} else if(ordinary.line != DivisionLine.embattled) {
				div.translate(new paper.Point(0, halfWidth*2));
				ord = ord.intersect(div) as paper.Path;
			} else {
				ord = ord.subtract(new paper.Path.Rectangle(
					new paper.Point(-200, fessPoint.y + halfWidth), new paper.Size(400,400),
				)) as paper.Path;
			}
			switch(ordinary.device.id) {
				case DeviceId.pale: {
					ord.rotate(90, fessPoint);
					break;
				}
				case DeviceId.bend: {
					ord.rotate(45, fessPoint);
					break;
				}
				case DeviceId.bendSinister: {
					ord.rotate(-45, fessPoint);
					break;
				}
			}
			chargePathMap.set(ordinary, calcShieldPart(ordinary, path.intersect(ord) as paper.Path, targetPart));
		} else if([DeviceId.chevron, DeviceId.chevronReversed].includes(ordinary.device.id)) {
			let reversed = DeviceId.chevronReversed == ordinary.device.id;
			let angles = [true, false].map(ex => {
				let angle = getRightAnglePathForLine(path, fessPoint, ordinary.line, ex);
				if(!reversed) {
					angle.scale(1, -1, fessPoint);
				}
				return angle;
			});
			angles[1].translate(new paper.Point(0, halfWidth*2*(reversed ? 1 : -1)));
			let chev = angles[1].subtract(angles[0]);
			chargePathMap.set(ordinary, calcShieldPart(ordinary, path.intersect(chev) as paper.Path, targetPart));
		} else if([DeviceId.cross, DeviceId.saltire].includes(ordinary.device.id)) {
			let angle = getRightAnglePathForLine(path, fessPoint, ordinary.line, true);
			angle.translate(new paper.Point(0, -halfWidth));
			if(DeviceId.cross == ordinary.device.id) {
				angle.rotate(-45, fessPoint);
			}
			let base = path.clone();
			for(let i=0; i<4; i++) {
				base = base.subtract(angle) as paper.Path;
				angle.rotate(90, fessPoint);
			}
			chargePathMap.set(ordinary, calcShieldPart(ordinary, base, targetPart));
		} else if([DeviceId.canton, DeviceId.quarter].includes(ordinary.device.id)) {
			let pt = fessPoint;
			if(DeviceId.canton == ordinary.device.id) {
				let size = Math.min(path.bounds.width, path.bounds.height) * .4;
				pt = new paper.Point(path.bounds.x + size, path.bounds.y + size);
			}
			let angle = getRightAnglePathForLine(path, pt, ordinary.line, false);
			angle.rotate(-45, pt);
			chargePathMap.set(ordinary, calcShieldPart(ordinary, path.intersect(angle) as paper.Path, targetPart));
		} else if([DeviceId.chief, DeviceId.base].includes(ordinary.device.id)) {
			let div = getIntersectionPathForDivision(path, fessPoint, new Division(DivisionType.fess, ordinary.line));
			if(DeviceId.chief == ordinary.device.id) {
				div.scale(1, -1, fessPoint);
			}
			let y = (fessPoint.y + (DeviceId.base == ordinary.device.id ? path.bounds.bottom : path.bounds.top)) / 2;
			div.translate(new paper.Point(0, y - fessPoint.y));
			chargePathMap.set(ordinary, calcShieldPart(ordinary, path.subtract(div) as paper.Path, targetPart));
		}
	}
	for(let c of part.charges) {
		paths.push(...(chargePathMap.get(c) ?? []));
	}
	return paths;
}

function calcShieldElements(shield: Part, targetPart: Part|null=null): PathData[] {
	let basePath = getPathForPart(shield, new paper.Rectangle(new paper.Point(-50, -50), new paper.Size(100, 100)));
	let result = calcShieldPart(shield, basePath, targetPart);
	scope.project.clear();
	return result;
}
