// Inline SVG tiles for the floors (textures.js, texturesMedieval.js).
//
// A board paints one floor across many cells, so a tile has to join itself on
// all four sides. Two things make that so: the structure is periodic in the tile
// size, and `svgUrl` draws the whole body nine times, shifted by -w/0/+w and
// -h/0/+h, so a mark that crosses a tile edge continues on the opposite one
// (the copies that fall outside the tile are clipped by the SVG viewport).
// Shapes with rounded ends must therefore be drawn longer than the tile, so
// their ends fall outside it.
export const svgUrl = (w, h, body) => {
  let uses = "";
  for (const dy of [-h, 0, h]) for (const dx of [-w, 0, w]) uses += `<use href='#t' x='${dx}' y='${dy}'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${w}' height='${h}'><defs><g id='t'>${body}</g></defs>${uses}</svg>`;
  return `url("data:image/svg+xml,${encodeURIComponent(svg)}")`;
};
