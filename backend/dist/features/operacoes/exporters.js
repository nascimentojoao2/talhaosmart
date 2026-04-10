"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.buildTalhoesExport = buildTalhoesExport;
function escapeXml(value) {
    return value
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}
function buildGeoJson(talhoes) {
    return {
        type: 'FeatureCollection',
        features: talhoes.map((talhao) => ({
            type: 'Feature',
            properties: {
                id: talhao.id,
                nome: talhao.nome,
                area: talhao.area,
                propriedade_id: talhao.propriedade_id,
                propriedade_nome: talhao.propriedade_nome || null
            },
            geometry: talhao.geojson
        }))
    };
}
function buildKml(talhoes) {
    const placemarks = talhoes.map((talhao) => {
        const coordinates = talhao.geojson.coordinates[0]
            .map((coordinate) => `${coordinate[0]},${coordinate[1]},0`)
            .join(' ');
        return `
      <Placemark>
        <name>${escapeXml(talhao.nome)}</name>
        <description>${escapeXml(talhao.propriedade_nome || 'Sem propriedade')}</description>
        <ExtendedData>
          <Data name="id"><value>${talhao.id}</value></Data>
          <Data name="area_ha"><value>${talhao.area}</value></Data>
          <Data name="propriedade_id"><value>${talhao.propriedade_id}</value></Data>
        </ExtendedData>
        <Polygon>
          <outerBoundaryIs>
            <LinearRing>
              <coordinates>${coordinates}</coordinates>
            </LinearRing>
          </outerBoundaryIs>
        </Polygon>
      </Placemark>
    `.trim();
    }).join('\n');
    return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>TalhaoSmart - Talhões</name>
    ${placemarks}
  </Document>
</kml>`;
}
function buildTalhoesExport(talhoes, format) {
    const totalTalhoes = talhoes.length;
    const talhaoIds = talhoes.map((talhao) => talhao.id);
    if (format === 'geojson') {
        return {
            filename: totalTalhoes === 1 ? `talhao-${talhaoIds[0]}.geojson` : 'talhoes.geojson',
            format,
            content_type: 'application/geo+json',
            total_talhoes: totalTalhoes,
            talhao_ids: talhaoIds,
            content: JSON.stringify(buildGeoJson(talhoes), null, 2)
        };
    }
    return {
        filename: totalTalhoes === 1 ? `talhao-${talhaoIds[0]}.kml` : 'talhoes.kml',
        format,
        content_type: 'application/vnd.google-earth.kml+xml',
        total_talhoes: totalTalhoes,
        talhao_ids: talhaoIds,
        content: buildKml(talhoes)
    };
}
