// <mapa-brasil> — mapa do Brasil com geometria real (Natural Earth via world-atlas), desenhado com d3-geo.
(() => {
  const CAPITAIS = [
    ["Manaus", -60.02, -3.10], ["Belém", -48.50, -1.46], ["Fortaleza", -38.52, -3.73],
    ["Recife", -34.88, -8.05], ["Salvador", -38.51, -12.97], ["Brasília", -47.88, -15.79],
    ["Cuiabá", -56.10, -15.60], ["Goiânia", -49.25, -16.68], ["Belo Horizonte", -43.94, -19.92],
    ["Rio de Janeiro", -43.17, -22.91], ["São Paulo", -46.63, -23.55], ["Curitiba", -49.27, -25.43],
    ["Florianópolis", -48.55, -27.59], ["Porto Alegre", -51.23, -30.03], ["Campo Grande", -54.65, -20.44],
    ["Rio Branco", -67.81, -9.97], ["São Luís", -44.30, -2.53], ["Natal", -35.21, -5.79],
    ["João Pessoa", -34.88, -7.11], ["Maceió", -35.73, -9.66], ["Aracaju", -37.07, -10.91],
    ["Teresina", -42.80, -5.09], ["Palmas", -48.33, -10.18], ["Boa Vista", -60.67, 2.82],
    ["Macapá", -51.07, 0.03], ["Porto Velho", -63.90, -8.76], ["Vitória", -40.34, -20.32]
  ];
  // Municípios adicionais (coordenadas reais) — densidade de alcance
  const CIDADES = [
    [-47.06,-22.91],[-46.33,-23.96],[-45.89,-23.18],[-47.81,-21.18],[-47.46,-23.50],[-49.06,-22.31],
    [-51.39,-22.13],[-49.38,-20.82],[-50.44,-21.21],[-49.95,-22.21],[-47.40,-20.54],
    [-48.28,-18.91],[-47.93,-19.75],[-43.35,-21.76],[-43.86,-16.73],[-41.95,-18.85],[-42.54,-19.47],
    [-41.30,-21.75],[-44.10,-22.52],[-43.18,-22.51],[-42.02,-22.88],[-40.29,-20.33],[-40.07,-19.39],
    [-39.03,-14.79],[-38.97,-12.27],[-40.84,-14.87],[-40.50,-9.42],[-40.50,-9.39],[-39.28,-14.79],
    [-35.98,-8.28],[-35.88,-7.23],[-37.34,-5.19],[-40.35,-3.69],[-39.32,-7.21],[-38.22,-9.40],
    [-36.66,-9.75],[-36.50,-8.89],[-37.28,-7.02],[-39.30,-6.36],[-40.68,-5.18],
    [-47.49,-5.53],[-49.13,-5.37],[-54.71,-2.44],[-52.21,-3.20],[-56.74,-2.63],[-64.72,-3.35],
    [-69.94,-4.25],[-63.03,-7.51],[-64.80,-7.26],[-62.92,-0.97],[-66.99,-0.13],[-63.14,-4.09],
    [-55.98,-4.28],[-51.83,3.84],[-60.44,0.94],[-72.67,-7.63],
    [-61.95,-10.88],[-60.14,-12.74],[-55.51,-11.86],[-54.64,-16.47],[-52.26,-15.89],
    [-54.81,-22.22],[-51.70,-20.79],[-48.95,-16.33],[-50.93,-17.79],[-47.95,-16.25],
    [-48.21,-7.19],[-49.07,-11.73],[-44.99,-12.15],[-43.42,-13.26],[-41.47,-7.08],[-43.02,-6.77],
    [-44.79,-4.23],[-46.04,-7.53],
    [-51.16,-23.31],[-51.94,-23.42],[-53.46,-24.96],[-54.59,-25.55],[-50.16,-25.09],
    [-48.85,-26.30],[-49.07,-26.92],[-52.62,-27.10],[-49.37,-28.68],
    [-51.18,-29.17],[-53.81,-29.68],[-52.34,-31.77],[-57.09,-29.76],[-52.41,-28.26],[-52.10,-32.03]
  ];

  const LIBS = [
    ["https://unpkg.com/d3@7.9.0/dist/d3.min.js", "sha384-CjloA8y00+1SDAUkjs099PVfnY2KmDC2BZnws9kh8D/lX1s46w6EPhpXdqMfjK6i", () => window.d3],
    ["https://unpkg.com/topojson-client@3.1.0/dist/topojson-client.min.js", "sha384-Ukv1p/xTma6P4/2bY5KzWBw+ydSpXmhCMtyciIQVDJ1RmOxtCYNMF1uXT9T63H67", () => window.topojson]
  ];
  const ATLAS = "https://cdn.jsdelivr.net/npm/world-atlas@2.0.2/countries-110m.json";
  const UFS = "https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo+json&intrarregiao=UF&qualidade=intermediaria";

  function load(src, integrity, ready) {
    if (ready()) return Promise.resolve();
    const found = document.querySelector('script[src="' + src + '"]');
    if (found && found.__p) return found.__p;
    const s = found || document.createElement("script");
    s.src = src; s.integrity = integrity; s.crossOrigin = "anonymous";
    s.__p = new Promise((res, rej) => { s.onload = res; s.onerror = rej; });
    if (!found) document.head.appendChild(s);
    return s.__p;
  }

  class MapaBrasil extends HTMLElement {
    connectedCallback() {
      if (this._built) return;
      this._built = true;
      const root = this.attachShadow({ mode: "open" });
      root.innerHTML = `
        <style>
          :host{display:block;position:relative;width:100%;aspect-ratio:1/1.02;}
          .halo{position:absolute;left:8%;top:10%;width:84%;height:80%;border-radius:50%;background:radial-gradient(circle at 50% 45%,rgba(255,255,255,0.18),transparent 66%);filter:blur(34px);pointer-events:none;}
          svg{position:relative;width:100%;height:100%;display:block;overflow:visible;}
          #contorno{fill:none;stroke:#FFFFFF;stroke-width:1.6;stroke-linejoin:round;stroke-dasharray:var(--len);stroke-dashoffset:var(--len);animation:tracar 2.6s cubic-bezier(.16,.84,.44,1) .15s forwards;}
          #massa{opacity:0;animation:surgir 1.5s ease 1.1s forwards;}
          #ufs path{fill:none;stroke:rgba(255,255,255,0.28);stroke-width:0.9;stroke-linejoin:round;vector-effect:non-scaling-stroke;}
          #ufs{opacity:0;animation:surgir 1.4s ease 1.5s forwards;}
          .cap{opacity:0;animation:surgir .5s ease forwards;}
          .cid{opacity:0;animation:surgir .6s ease forwards;}
          .pulso{transform-box:fill-box;transform-origin:center;animation:pulsar 3.2s ease-out infinite;}
          @keyframes tracar{to{stroke-dashoffset:0;}}
          @keyframes surgir{to{opacity:1;}}
          @keyframes pulsar{0%{transform:scale(1);opacity:.55;}70%{transform:scale(3.4);opacity:0;}100%{transform:scale(3.4);opacity:0;}}
          @media(prefers-reduced-motion:reduce){#contorno,#massa,.cap{animation:none;stroke-dashoffset:0;opacity:1;}.pulso{animation:none;opacity:0;}}
        </style>
        <div class="halo"></div>
        <svg viewBox="0 0 600 612" role="img" aria-label="Mapa do Brasil com as 27 capitais atendidas"></svg>`;
      this._svg = root.querySelector("svg");

      const io = new IntersectionObserver((es) => {
        if (es.some((e) => e.isIntersecting)) { io.disconnect(); this.desenhar(); }
      }, { rootMargin: "300px" });
      io.observe(this);
    }

    async desenhar() {
      try {
        for (const [src, sri, ready] of LIBS) await load(src, sri, ready);
        const topo = await (await fetch(ATLAS)).json();
        const feats = topojson.feature(topo, topo.objects.countries).features;
        const br = feats.find((f) => f.properties && f.properties.name === "Brazil");
        if (!br) throw new Error("Brasil não encontrado no atlas");

        const W = 600, H = 612, pad = 26;
        const proj = d3.geoMercator().fitExtent([[pad, pad], [W - pad, H - pad]], br);
        const path = d3.geoPath(proj);
        const d = path(br);
        const ns = "http://www.w3.org/2000/svg";
        const svg = this._svg;

        svg.innerHTML =
          '<defs>' +
            '<linearGradient id="grad" x1="0" y1="0" x2="0.6" y2="1">' +
              '<stop offset="0%" stop-color="#4A4A4A"/><stop offset="55%" stop-color="#232323"/><stop offset="100%" stop-color="#0B0B0B"/>' +
            '</linearGradient>' +
            '<filter id="sombra" x="-20%" y="-20%" width="140%" height="140%">' +
              '<feDropShadow dx="0" dy="16" stdDeviation="18" flood-color="#000000" flood-opacity="0.65"/>' +
            '</filter>' +
          '</defs>' +
            '<clipPath id="clipBR"><path d="' + d + '"/></clipPath>' +
          '<g id="massa" filter="url(#sombra)"><path d="' + d + '" fill="url(#grad)"/></g>' +
          '<g id="ufs" clip-path="url(#clipBR)"></g>' +
          '<path id="contorno" d="' + d + '"/>';

        // divisas estaduais (malha oficial do IBGE), recortadas pelo contorno do país
        fetch(UFS).then((r) => r.json()).then((geo) => {
          const alvo = svg.querySelector("#ufs");
          if (!alvo || !geo) return;
          const fs = geo.features || [geo];
          alvo.innerHTML = fs.map((f) => '<path d="' + (path(f) || "") + '"/>').join("");
        }).catch((e) => console.warn("[mapa-brasil] divisas indisponíveis", e));

        const contorno = svg.querySelector("#contorno");
        contorno.style.setProperty("--len", Math.ceil(contorno.getTotalLength()));

        const gc = document.createElementNS(ns, "g");
        CIDADES.forEach(([lng, lat], i) => {
          const p = proj([lng, lat]);
          if (!p) return;
          const c = document.createElementNS(ns, "circle");
          c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]); c.setAttribute("r", 1.8);
          c.setAttribute("fill", "rgba(255,255,255,0.55)");
          c.setAttribute("class", "cid");
          c.style.animationDelay = (1.6 + (i % 20) * 0.05) + "s";
          gc.appendChild(c);
        });
        svg.appendChild(gc);

        const g = document.createElementNS(ns, "g");
        CAPITAIS.forEach(([nome, lng, lat], i) => {
          const p = proj([lng, lat]);
          if (!p) return;
          const wrap = document.createElementNS(ns, "g");
          wrap.setAttribute("class", "cap");
          wrap.style.animationDelay = (1.5 + i * 0.045) + "s";
          if (nome === "Brasília") {
            const halo = document.createElementNS(ns, "circle");
            halo.setAttribute("cx", p[0]); halo.setAttribute("cy", p[1]); halo.setAttribute("r", 4);
            halo.setAttribute("fill", "#FFFFFF"); halo.setAttribute("class", "pulso");
            wrap.appendChild(halo);
          }
          const c = document.createElementNS(ns, "circle");
          c.setAttribute("cx", p[0]); c.setAttribute("cy", p[1]);
          c.setAttribute("r", nome === "Brasília" ? 4.4 : 3.2);
          c.setAttribute("fill", "#FFFFFF");
          c.setAttribute("stroke", "rgba(11,11,11,0.6)"); c.setAttribute("stroke-width", "1");
          const t = document.createElementNS(ns, "title");
          t.textContent = nome;
          c.appendChild(t);
          wrap.appendChild(c);
          g.appendChild(wrap);
        });
        svg.appendChild(g);
      } catch (e) {
        console.warn("[mapa-brasil]", e);
      }
    }
  }
  if (!customElements.get("mapa-brasil")) customElements.define("mapa-brasil", MapaBrasil);
})();
