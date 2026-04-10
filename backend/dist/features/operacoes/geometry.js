"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateSprayMissionPlan = generateSprayMissionPlan;
const EARTH_RADIUS_M = 6378137;
const EPSILON = 1e-6;
function degToRad(value) {
    return (value * Math.PI) / 180;
}
function radToDeg(value) {
    return (value * 180) / Math.PI;
}
function normalizeDegrees180(value) {
    let normalized = value % 180;
    if (normalized < 0)
        normalized += 180;
    return normalized;
}
function roundTo(value, digits = 2) {
    const multiplier = 10 ** digits;
    return Math.round(value * multiplier) / multiplier;
}
function projectCoordinate(longitude, latitude, originLongitude, originLatitude) {
    const x = degToRad(longitude - originLongitude) * EARTH_RADIUS_M * Math.cos(degToRad(originLatitude));
    const y = degToRad(latitude - originLatitude) * EARTH_RADIUS_M;
    return { x, y };
}
function unprojectCoordinate(point, originLongitude, originLatitude) {
    const longitude = originLongitude + radToDeg(point.x / (EARTH_RADIUS_M * Math.cos(degToRad(originLatitude))));
    const latitude = originLatitude + radToDeg(point.y / EARTH_RADIUS_M);
    return [roundTo(longitude, 7), roundTo(latitude, 7)];
}
function rotatePoint(point, angleRadians) {
    const cos = Math.cos(angleRadians);
    const sin = Math.sin(angleRadians);
    return {
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos
    };
}
function distanceBetween(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y);
}
function getPolygonRing(geojson) {
    const ring = Array.isArray(geojson?.coordinates?.[0]) ? geojson.coordinates[0] : [];
    if (ring.length < 4) {
        throw new Error('O polígono do talhão é inválido para planejamento operacional.');
    }
    const normalized = ring.map((point) => [Number(point[0]), Number(point[1])]);
    const first = normalized[0];
    const last = normalized[normalized.length - 1];
    if (first[0] === last[0] && first[1] === last[1]) {
        return normalized.slice(0, -1);
    }
    return normalized;
}
function getOrigin(ring) {
    const sum = ring.reduce((accumulator, point) => {
        accumulator.longitude += point[0];
        accumulator.latitude += point[1];
        return accumulator;
    }, { longitude: 0, latitude: 0 });
    return {
        longitude: sum.longitude / ring.length,
        latitude: sum.latitude / ring.length
    };
}
function getRouteOrientation(projectedRing) {
    let longestLength = 0;
    let bestAngle = 0;
    for (let index = 0; index < projectedRing.length; index += 1) {
        const start = projectedRing[index];
        const end = projectedRing[(index + 1) % projectedRing.length];
        const length = distanceBetween(start, end);
        if (length <= longestLength)
            continue;
        longestLength = length;
        bestAngle = Math.atan2(end.y - start.y, end.x - start.x);
    }
    return normalizeDegrees180(radToDeg(bestAngle));
}
function buildSweepLevels(minY, maxY, larguraFaixa) {
    const height = maxY - minY;
    if (height <= EPSILON)
        return { levels: [(minY + maxY) / 2], spacing: larguraFaixa };
    const totalFaixas = Math.max(1, Math.ceil(height / larguraFaixa));
    const spacing = height / totalFaixas;
    return {
        spacing,
        levels: Array.from({ length: totalFaixas }, (_value, index) => minY + spacing / 2 + index * spacing)
    };
}
function getSweepIntervals(rotatedRing, y, sweepIndex) {
    const intersections = [];
    for (let index = 0; index < rotatedRing.length; index += 1) {
        const start = rotatedRing[index];
        const end = rotatedRing[(index + 1) % rotatedRing.length];
        if (Math.abs(start.y - end.y) <= EPSILON)
            continue;
        const minY = Math.min(start.y, end.y);
        const maxY = Math.max(start.y, end.y);
        if (y < minY || y >= maxY)
            continue;
        const ratio = (y - start.y) / (end.y - start.y);
        const x = start.x + ratio * (end.x - start.x);
        intersections.push(x);
    }
    intersections.sort((left, right) => left - right);
    const intervals = [];
    for (let index = 0; index + 1 < intersections.length; index += 2) {
        const x1 = intersections[index];
        const x2 = intersections[index + 1];
        if (x2 - x1 <= EPSILON)
            continue;
        intervals.push({ x1, x2, y, sweepIndex });
    }
    return intervals;
}
function pushPathPoint(path, point) {
    const lastPoint = path[path.length - 1];
    if (!lastPoint || distanceBetween(lastPoint, point) > EPSILON) {
        path.push(point);
    }
}
function toLineString(points, originLongitude, originLatitude) {
    return {
        type: 'LineString',
        coordinates: points.map((point) => unprojectCoordinate(point, originLongitude, originLatitude))
    };
}
function buildMissionRoute(rotatedRing, orientationDegrees, originLongitude, originLatitude, larguraFaixa) {
    const ys = rotatedRing.map((point) => point.y);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const { levels, spacing } = buildSweepLevels(minY, maxY, larguraFaixa);
    const routeSegments = [];
    const routePath = [];
    let currentPoint = null;
    let totalTransitionDistance = 0;
    let routeOrder = 1;
    levels.forEach((y, sweepIndex) => {
        const intervals = getSweepIntervals(rotatedRing, y, sweepIndex);
        if (!intervals.length)
            return;
        const orderedIntervals = sweepIndex % 2 === 0
            ? intervals
            : [...intervals].reverse();
        orderedIntervals.forEach((interval) => {
            const forwardStart = { x: interval.x1, y: interval.y };
            const forwardEnd = { x: interval.x2, y: interval.y };
            const reverseStart = { x: interval.x2, y: interval.y };
            const reverseEnd = { x: interval.x1, y: interval.y };
            let start = forwardStart;
            let end = forwardEnd;
            if (currentPoint) {
                const distanceForward = distanceBetween(currentPoint, forwardStart);
                const distanceReverse = distanceBetween(currentPoint, reverseStart);
                if (distanceReverse + EPSILON < distanceForward) {
                    start = reverseStart;
                    end = reverseEnd;
                }
            }
            else if (sweepIndex % 2 !== 0) {
                start = reverseStart;
                end = reverseEnd;
            }
            if (currentPoint) {
                totalTransitionDistance += distanceBetween(currentPoint, start);
            }
            pushPathPoint(routePath, start);
            pushPathPoint(routePath, end);
            routeSegments.push({
                order: routeOrder,
                sweepIndex,
                start,
                end,
                length: distanceBetween(start, end)
            });
            currentPoint = end;
            routeOrder += 1;
        });
    });
    if (!routeSegments.length || routePath.length < 2) {
        throw new Error('Não foi possível gerar passadas válidas para este polígono. Revise o desenho do talhão.');
    }
    const rotationRadians = degToRad(orientationDegrees);
    const rotatedSegments = routeSegments.map((segment) => {
        const start = rotatePoint(segment.start, rotationRadians);
        const end = rotatePoint(segment.end, rotationRadians);
        return { ...segment, start, end };
    });
    const rotatedPath = routePath.map((point) => rotatePoint(point, rotationRadians));
    const passFeatures = rotatedSegments.map((segment) => ({
        type: 'Feature',
        properties: {
            kind: 'pass',
            ordem: segment.order,
            sweep_index: segment.sweepIndex,
            comprimento_m: roundTo(segment.length, 2)
        },
        geometry: toLineString([segment.start, segment.end], originLongitude, originLatitude)
    }));
    const pathFeature = {
        type: 'Feature',
        properties: {
            kind: 'route',
            total_segmentos: rotatedSegments.length,
            distancia_transicao_m: roundTo(totalTransitionDistance, 2)
        },
        geometry: toLineString(rotatedPath, originLongitude, originLatitude)
    };
    const comprimentoPassadas = routeSegments.reduce((sum, segment) => sum + segment.length, 0);
    const estatisticas = {
        total_faixas: levels.length,
        total_passadas: routeSegments.length,
        comprimento_passadas_m: roundTo(comprimentoPassadas, 2),
        distancia_transicao_m: roundTo(totalTransitionDistance, 2),
        distancia_total_m: roundTo(comprimentoPassadas + totalTransitionDistance, 2),
        largura_faixa_configurada_m: roundTo(larguraFaixa, 2),
        largura_faixa_efetiva_m: roundTo(spacing, 2)
    };
    const rota_geojson = {
        type: 'FeatureCollection',
        features: [...passFeatures, pathFeature]
    };
    return { rota_geojson, estatisticas };
}
function generateSprayMissionPlan(talhao, larguraFaixa) {
    if (!Number.isFinite(larguraFaixa) || larguraFaixa <= 0) {
        throw new Error('A largura de faixa deve ser maior que zero.');
    }
    const ring = getPolygonRing(talhao.geojson);
    if (ring.length < 3) {
        throw new Error('O polígono do talhão precisa ter pelo menos 3 vértices.');
    }
    const origin = getOrigin(ring);
    const projectedRing = ring.map((point) => projectCoordinate(point[0], point[1], origin.longitude, origin.latitude));
    const orientationDegrees = getRouteOrientation(projectedRing);
    const rotatedRing = projectedRing.map((point) => rotatePoint(point, -degToRad(orientationDegrees)));
    const { rota_geojson, estatisticas } = buildMissionRoute(rotatedRing, orientationDegrees, origin.longitude, origin.latitude, larguraFaixa);
    return {
        talhao_id: talhao.id,
        tipo: 'pulverizacao',
        largura_faixa: roundTo(larguraFaixa, 2),
        orientacao_graus: roundTo(orientationDegrees, 2),
        area_cobertura: roundTo(talhao.area, 2),
        rota_geojson,
        estatisticas
    };
}
