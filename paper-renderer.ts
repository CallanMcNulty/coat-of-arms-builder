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
	let path: paper.Path|null = null;
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
		case DeviceId.mascle:
			let halfWidth = box.height * .4;
			path = new paper.Path([
				new paper.Point(box.center.x, box.point.y),
				new paper.Point(box.center.x - halfWidth, box.center.y),
				new paper.Point(box.center.x, box.bottom),
				new paper.Point(box.center.x + halfWidth, box.center.y),
			]);
			path.closePath();
			if(dev.id == DeviceId.mascle) {
				let hole = path.clone();
				hole.scale(.6);
				path = path.subtract(hole) as paper.Path;
			}
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
		case DeviceId.crescent:
			let circle = new paper.Path.Circle(box.center, box.width/2);
			let miniCircle = new paper.Path.Circle(new paper.Point(box.center.x, box.center.y - box.height*.2), box.width*.35);
			path = circle.subtract(miniCircle) as paper.Path;
			break;
		case DeviceId.billet:
			path = new paper.Path.Rectangle(new paper.Rectangle(new paper.Point(0,0), new paper.Size(20, 40)));
			break;
		case DeviceId.escutcheon:
			let root = part;
			while(root.parent) {
				root = root.parent;
			}
			return getPathForPart(root, box);
		case DeviceId.tower:
			path = (new paper.Path('M 75 150 L 100 150 L 100 175 L 125 175 L 125 150 L 150 150 L 150 175 L 175 175 L 175 150 L 200 150 L 200 175 L 225 175 L 225 150 L 250 150 L 250 200 L 75 200 L 75 150 Z')
				.unite(new paper.Path('M 200 412.5 C 200 391.79 183.211 375 162.5 375 C 141.79 375 125 391.79 125 412.5 L 125 440.744 L 50 440.744 L 50 400 C 100 350 100 260 100 260 L 79.628 209.256 L 245.372 209.256 L 225 260 C 224.981 259.98 225 350 275 400 L 275 440.744 L 200 440.744 L 200 412.5 Z'))
				.unite(new paper.Path('M 275 475 L 200 475 L 200 450 L 275 450 L 275 475 Z'))
				.unite(new paper.Path('M 125 475 L 50 475 L 50 450 L 125 450 L 125 475 Z'))
				.subtract(new paper.Path('M 150 272.5 L 150 310 L 175 310 L 175 272.5 C 175 265.596 169.404 260 162.5 260 C 155.596 260 150 265.596 150 272.5 Z'))
			) as paper.Path;
			break;
		case DeviceId.crown:
			path = new paper.Path('M 25 300 C 25.011 299.988 75 325 68.35 357.799 C 67.502 360.719 67.048 363.807 67.048 367 C 67.048 385.187 81.782 399.933 99.964 399.952 L 100 400 L 100.024 399.952 C 118.212 399.939 132.952 385.191 132.952 367 C 132.952 359.59 130.506 352.75 126.377 347.246 C 125 325 149.972 274.793 150 275 C 150.187 274.447 175 325 173.623 347.246 C 169.494 352.75 167.048 359.59 167.048 367 C 167.048 385.191 181.788 399.939 199.976 399.952 L 200 400 L 200.036 399.952 C 218.218 399.933 232.952 385.187 232.952 367 C 232.952 363.807 232.498 360.719 231.65 357.799 C 225 325 274.955 299.928 275 300 L 254.894 440.744 L 45.106 440.744 Z').unite(new paper.Path('M 250 475 L 50 475 L 46.429 450 L 253.571 450 Z')) as paper.Path;
			break;
		case DeviceId.key:
			path = (new paper.Path('M 162.5 478 C 162.5 505.614 140.114 528 112.5 528 C 84.886 528 62.5 505.614 62.5 478 C 62.5 454.702 78.435 435.126 100 429.575 L 100 325 L 50 325 L 50 300 L 75 300 L 75 275 L 50 275 L 50 250 L 100 250 L 100 235.642 L 125 235.642 L 125 429.575 C 146.565 435.126 162.5 454.702 162.5 478 Z')
				.subtract(new paper.Path('M 112.5 453 C 98.693 453 87.5 464.193 87.5 478 C 87.5 491.807 98.693 503 112.5 503 C 126.307 503 137.5 491.807 137.5 478 C 137.5 464.193 126.307 453 112.5 453 Z'))
			) as paper.Path;
			break;
		case DeviceId.trefoil:
			path = new paper.Path('M 250 461 C 250 467.904 244.404 473.5 237.5 473.5 C 230.596 473.5 225 467.904 225 461 L 230.533 418.95 C 222.096 428.472 209.775 434.474 196.053 434.474 C 170.618 434.474 150 413.855 150 388.421 C 150 362.987 170.618 342.368 196.053 342.368 C 197.183 342.368 198.304 342.409 199.414 342.489 C 194.382 335.108 191.44 326.187 191.44 316.579 C 191.44 291.145 212.058 270.526 237.492 270.526 C 262.927 270.526 283.545 291.145 283.545 316.579 C 283.545 326.187 280.602 335.109 275.569 342.49 C 276.685 342.41 277.811 342.368 278.947 342.368 C 304.382 342.368 325 362.987 325 388.421 C 325 413.855 304.382 434.474 278.947 434.474 C 265.225 434.474 252.904 428.472 244.467 418.95 Z');
			break;
		default:
			path = new paper.Path.Circle(box.center, box.width/2);
			if(dev.id == DeviceId.annulet) {
				path = path.subtract(new paper.Path.Circle(box.center, box.width*.3)) as paper.Path;
			}
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
					new paper.Point(fessPoint.x + dir * inc * params.orth, workingY + .5*inc)
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
				path.subtract(topRightAngleLine).subtract(bottomRightAngleLine).intersect(paleIntersection),
				path.subtract(topRightAngleLine).subtract(bottomRightAngleLine).subtract(paleIntersection),
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
				bottomRightAngleLine.intersect(path.intersect(paleIntersection), {trace:false}),
				bottomRightAngleLine.intersect(path.subtract(paleIntersection), {trace:false}),
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

function calcShieldPart(
	part: Part, path: paper.Path, targetPart: Part|null=null, parentFessPoint: paper.Point|null=null
): PathData[] {
	let paths: PathData[] = [];
	let fessPoint = getFessPointForDevice(part.device, path);
	// divisions / field
	if(part.division.type != DivisionType.none) {
		let subdivisions = dividePath(path, part.division, fessPoint);
		if(part == targetPart) {
			paths.push({ path:path?.pathData, color:'wheat' });
			return paths;
		}
		paths.push(...part.parts.flatMap((p, i) => calcShieldPart(p, subdivisions[i], targetPart, fessPoint)));
	} else {
		if(!targetPart || part == targetPart) {
			let applyTincture = (tincturedPath: paper.Path, tincture: Tincture) => {
				if(![Tincture.ermine, Tincture.vair].includes(tincture)) {
					paths.push({ path:tincturedPath?.pathData, color:colorMap.get(tincture) });
				} else {
					paths.push({ path:tincturedPath?.pathData, color:colorMap.get(Tincture.argent) });
					let even = true;
					for(let y=-49.99; y<60; y+=10) {
						let xOffset = even ? 0 : 5;
						for(let baseX=-50; baseX<60; baseX+=10) {
							let x = baseX + xOffset;
							if(tincture == Tincture.ermine) {
								let tipY = y + 6;
								let halfWidth = 2.5;
								let nudge = halfWidth*.8;
								let dotRad = .7;
								let dotOffset = 1.3;
								let spotPaths = [
									new paper.Path([
										new paper.Segment(new paper.Point(x+halfWidth*.3, tipY-1)),
										new paper.Segment(new paper.Point(x, tipY)),
										new paper.Segment(new paper.Point(x-halfWidth*.3, tipY-1)),
										new paper.Segment(
											new paper.Point(x-halfWidth, tipY), undefined, new paper.Point(nudge, -halfWidth),
										),
										new paper.Segment(new paper.Point(x, y)),
										new paper.Segment(
											new paper.Point(x+halfWidth, tipY), new paper.Point(-nudge, -halfWidth),
										),
									]),
									new paper.Path.Circle(new paper.Point(x, y-dotOffset), dotRad),
									new paper.Path.Circle(new paper.Point(x-dotOffset, y), dotRad),
									new paper.Path.Circle(new paper.Point(x+dotOffset, y), dotRad),
								].map(p => p.intersect(tincturedPath)).filter(p => (p as paper.Path).area);
								paths.push(...spotPaths.map(s => ({path:s.pathData, color:colorMap.get(Tincture.sable)})));
							} else {
								let spotPath = new paper.Path([
									new paper.Point(x,y),
									new paper.Point(x+2.5, y+3),
									new paper.Point(x+2.5, y+7),
									new paper.Point(x+5, y+10),
									new paper.Point(x-5, y+10),
									new paper.Point(x-2.5, y+7),
									new paper.Point(x-2.5, y+3),
								]).intersect(path) as paper.Path;
								if(spotPath.area) {
									paths.push({
										path: spotPath.pathData,
										color: colorMap.get(Tincture.azure),
									});
								}
							}
						}
						even = !even;
					}
				}
			};
			applyTincture(path, part.field.tincture);
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
				let twoWay = [FieldVariation.lozengy, FieldVariation.chequy].includes(part.field.variation);
				if(twoWay) {
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
				}
				let line = twoWay ? DivisionLine.straight : part.field.variationLine;
				let divider = getIntersectionPathForDivision(path,
					new paper.Point(fessPoint.x, path.bounds.y),
					new Division(DivisionType.fess, line),
				);
				for(let i=0; i<part.field.number; i++) {
					let bar = path.subtract(divider);
					divider.translate(new paper.Point(0, barSize));
					bar = bar.intersect(divider);
					let oddRow = i%2 == 1;
					if(twoWay) {
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
				bars.forEach(b => applyTincture(b, part.field.tinctureSecondary));
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
			if( // for symmetric cross arrangements, try to remain symmetric
				targetArrangement == ChargeArrangement.crosswise &&
				chargesPerLineInfo[0].actual == chargesPerLineInfo[1].actual
			) {
				if(toDistribute % 2 == 0) {
					let perArm = toDistribute/2;
					chargesPerLineInfo[0].actual += perArm;
					chargesPerLineInfo[1].actual += perArm;
				} else {
					chargesPerLineInfo[2].actual += toDistribute;
				}
			} else {
				chargesPerLineInfo.sort((a,b) => b.expected%1 - a.expected%1);
				for(let i=0; i<toDistribute; i++) {
					let info = chargesPerLineInfo[i];
					info.actual++;
				}
			}
			return lineSet.map(l => chargesPerLineInfo.find(i => i.line == l)!.actual - 1);
		};
		let ordinaryArrangementMap = new Map([
			[DeviceId.fess, ChargeArrangement.fesswise],
			[DeviceId.pale, ChargeArrangement.palewise],
			[DeviceId.bend, ChargeArrangement.bendwise],
			[DeviceId.bendSinister, ChargeArrangement.bendwiseSinister],
			[DeviceId.chevron, ChargeArrangement.chevronwise],
			[DeviceId.chevronReversed, ChargeArrangement.chevronwiseReversed],
			[DeviceId.saltire, ChargeArrangement.saltirewise],
			[DeviceId.cross, ChargeArrangement.crosswise],
		]);
		let targetArrangement = part.chargeArrangement;
		let targetMidPoint = fessPoint;
		if(targetArrangement == ChargeArrangement.unspecified) {
			let mapped = ordinaryArrangementMap.get(part.device.id);
			if(mapped) {
				targetArrangement = mapped;
				if(parentFessPoint) {
					targetMidPoint = parentFessPoint;
				}
			}
		}
		switch(targetArrangement) {
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
				lines = dividePath(path, new Division(DivisionType.fess, DivisionLine.straight), targetMidPoint, true);
				break;
			case ChargeArrangement.palewise:
				lines = dividePath(path, new Division(DivisionType.pale, DivisionLine.straight), targetMidPoint, true);
				break;
			case ChargeArrangement.bendwise:
				lines = dividePath(path, new Division(DivisionType.bend, DivisionLine.straight), targetMidPoint, true);
				break;
			case ChargeArrangement.bendwiseSinister:
				lines = dividePath(path, new Division(DivisionType.bendSinister, DivisionLine.straight), targetMidPoint, true);
				break;
			case ChargeArrangement.chevronwise:
				lines = dividePath(path, new Division(DivisionType.chevron, DivisionLine.straight), targetMidPoint, true);
				break;
			case ChargeArrangement.chevronwiseReversed:
				lines = dividePath(path, new Division(DivisionType.chevronReversed, DivisionLine.straight), targetMidPoint, true);
				break;
			case ChargeArrangement.crosswise:
				lines = dividePath(path, new Division(DivisionType.quarterly, DivisionLine.straight), targetMidPoint, true);
				break;
			case ChargeArrangement.saltirewise:
				lines = dividePath(path, new Division(DivisionType.saltire, DivisionLine.straight), targetMidPoint, true);
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
				if(mobileCharges.length % 2 == 1 &&
					(mobileCharges.length == 1 || targetArrangement != ChargeArrangement.crosswise)
				) {
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
				if(chargeCount && chargeSeparation < minChargeSeparation) {
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
			let chargeSize = minChargeSeparation * .9;
			// ensure charges are (probably) not too big for available space
			let sampleCount = Math.min(3, chargePositions.length);
			for(let i=0; i<sampleCount; i++) {
				let idx = i;
				if(chargePositions.length > 3) {
					idx = Math.floor((chargePositions.length*i)/3);
				}
				let pos = chargePositions[idx];
				let lengths = [DivisionType.fess, DivisionType.pale, DivisionType.bend, DivisionType.bendSinister].map(
					div => dividePath(path, new Division(div, DivisionLine.straight), pos, true).pop()
				).map(l => l?.length ?? 0 * .6).filter(n => n > 1);
				chargeSize = Math.min(chargeSize, ...lengths);
			}
			// create charge paths
			for(let [chargeIdx, charge] of mobileCharges.entries()) {
				let pos = chargePositions[chargeIdx];
				let chargePath = getPathForPart(charge,
					new paper.Rectangle(
						new paper.Point(pos.x - chargeSize/2, pos.y - chargeSize/2),
						new paper.Size(chargeSize, chargeSize),
					),
				);
				chargePathMap.set(charge, calcShieldPart(charge, path.intersect(chargePath) as paper.Path, targetPart, fessPoint));
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
			chargePathMap.set(ordinary, calcShieldPart(ordinary, path.intersect(ord) as paper.Path, targetPart, fessPoint));
		} else if([DeviceId.chevron, DeviceId.chevronReversed].includes(ordinary.device.id)) {
			let reversed = DeviceId.chevronReversed == ordinary.device.id;
			let angles = [true, false].map(ex => {
				let angle = getRightAnglePathForLine(path, fessPoint, ordinary.line, ex);
				if(!reversed) {
					angle.scale(1, -1, fessPoint);
				}
				return angle;
			});
			let dist = halfWidth*2*(reversed ? 1 : -1);
			angles[1].translate(new paper.Point(0, dist));
			let chev = angles[1].subtract(angles[0]);
			chargePathMap.set(ordinary, calcShieldPart(
				ordinary, path.intersect(chev) as paper.Path, targetPart, new paper.Point(fessPoint.x, fessPoint.y + dist*.16)
			));
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
			chargePathMap.set(ordinary, calcShieldPart(ordinary, base, targetPart, fessPoint));
		} else if([DeviceId.canton, DeviceId.quarter].includes(ordinary.device.id)) {
			let pt = fessPoint;
			if(DeviceId.canton == ordinary.device.id) {
				let size = Math.min(path.bounds.width, path.bounds.height) * .4;
				pt = new paper.Point(path.bounds.x + size, path.bounds.y + size);
			}
			let angle = getRightAnglePathForLine(path, pt, ordinary.line, false);
			angle.rotate(-45, pt);
			chargePathMap.set(ordinary, calcShieldPart(ordinary, path.intersect(angle) as paper.Path, targetPart, fessPoint));
		} else if([DeviceId.chief, DeviceId.base].includes(ordinary.device.id)) {
			let div = getIntersectionPathForDivision(path, fessPoint, new Division(DivisionType.fess, ordinary.line));
			if(DeviceId.chief == ordinary.device.id) {
				div.scale(1, -1, fessPoint);
			}
			let y = (fessPoint.y + (DeviceId.base == ordinary.device.id ? path.bounds.bottom : path.bounds.top)) / 2;
			div.translate(new paper.Point(0, y - fessPoint.y));
			chargePathMap.set(ordinary, calcShieldPart(ordinary, path.subtract(div) as paper.Path, targetPart, fessPoint));
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
