// site.js — espelho estático (sem React/Babel) da página de divórcio.
// Só roda para navegação real de topo; o editor visual (dentro de iframe)
// continua usando support.js + mapa-brasil.js normalmente, via o bloco
// original preservado em <template id="dc-source">. Ver index.html.
(function () {
  "use strict";
  if (window.self !== window.top) return;

  function propsPadrao() {
    var padrao = {
      telefoneWhatsapp: "551533470189",
      mensagemWhatsapp: "Oi, vim pelo site e quero orientação sobre o meu divórcio.",
      endpointPlanilha: "https://script.google.com/macros/s/AKfycbzHZUo-MCgTiJJ2XWIHXoQUo4UyQYeRaHpeJBX4WXM7Yzc9lmpcc0ZIkoReL2Cgtagp/exec"
    };
    try {
      var tpl = document.getElementById("dc-source");
      var script = tpl && tpl.content.querySelector("script[data-dc-script]");
      var raw = script && script.getAttribute("data-props");
      if (!raw) return padrao;
      var props = JSON.parse(raw);
      return {
        telefoneWhatsapp: (props.telefoneWhatsapp && props.telefoneWhatsapp.default) || padrao.telefoneWhatsapp,
        mensagemWhatsapp: (props.mensagemWhatsapp && props.mensagemWhatsapp.default) || padrao.mensagemWhatsapp,
        endpointPlanilha: (props.endpointPlanilha && props.endpointPlanilha.default) || padrao.endpointPlanilha
      };
    } catch (err) {
      return padrao;
    }
  }

  var PROPS = propsPadrao();
  var FONE = PROPS.telefoneWhatsapp.replace(/\D/g, "");
  var WA_LINK = "https://wa.me/" + FONE + "?text=" + encodeURIComponent(PROPS.mensagemWhatsapp);

  document.querySelectorAll("[data-wa-msg]").forEach(function (el) {
    var msg = el.getAttribute("data-wa-msg") || PROPS.mensagemWhatsapp;
    el.setAttribute("href", "https://wa.me/" + FONE + "?text=" + encodeURIComponent(msg));
  });
  document.querySelectorAll("[data-wa-default]").forEach(function (el) {
    el.setAttribute("href", WA_LINK);
  });

  // ---------- Popup de contato (lead) ----------
  var popupOverlay = document.getElementById("popup-overlay");
  var popupForm = document.getElementById("popup-form");
  var popupTitulo = document.getElementById("tp-form-titulo");
  var popupSub = document.getElementById("popup-sub");
  var popupErro = document.getElementById("popup-erro");
  var popupNome = document.getElementById("popup-nome");
  var popupTel = document.getElementById("popup-tel");
  var popupEmail = document.getElementById("popup-email");
  var pendingMsg = "";

  function abrirPopup(msg, titulo, sub) {
    pendingMsg = msg || PROPS.mensagemWhatsapp;
    popupTitulo.textContent = titulo || "Vamos conversar?";
    popupSub.textContent = sub || "Deixe seu nome e WhatsApp — a mensagem já vai pronta.";
    popupErro.hidden = true;
    popupErro.textContent = "";
    popupOverlay.hidden = false;
  }
  function fecharPopup() {
    popupOverlay.hidden = true;
  }
  document.querySelectorAll("[data-close-popup]").forEach(function (el) {
    el.addEventListener("click", fecharPopup);
  });
  document.addEventListener("click", function (ev) {
    var el = ev.target.closest && ev.target.closest("[data-wa-msg]");
    if (!el) return;
    ev.preventDefault();
    abrirPopup(el.getAttribute("data-wa-msg"));
  });

  function capturarUtm() {
    try {
      if (sessionStorage.getItem("lead_utm")) return;
      var q = new URLSearchParams(window.location.search);
      var utm = {
        utm_source: q.get("utm_source") || "", utm_medium: q.get("utm_medium") || "",
        utm_campaign: q.get("utm_campaign") || "", utm_term: q.get("utm_term") || "",
        utm_content: q.get("utm_content") || "", gclid: q.get("gclid") || "", fbclid: q.get("fbclid") || ""
      };
      sessionStorage.setItem("lead_utm", JSON.stringify(utm));
    } catch (err) {}
  }
  capturarUtm();

  function enviarPlanilha(nome, email, tel) {
    var endpoint = PROPS.endpointPlanilha;
    if (!endpoint) return;
    var utm = {};
    try { utm = JSON.parse(sessionStorage.getItem("lead_utm") || "{}"); } catch (err) {}
    var dados = Object.assign({
      nome: nome, email: email, whatsapp: tel, mensagem: pendingMsg || "",
      origem_form: "popup", pagina: window.location.href
    }, utm);
    var qs = Object.keys(dados).map(function (k) {
      return encodeURIComponent(k) + "=" + encodeURIComponent(dados[k] || "");
    }).join("&");
    try { new Image().src = endpoint + "?" + qs; } catch (err) {}
    try { fetch(endpoint, { method: "POST", mode: "no-cors", body: JSON.stringify(dados) }); } catch (err) {}
  }

  if (popupForm) {
    popupForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var nome = popupNome.value, tel = popupTel.value, email = popupEmail.value;
      if (!nome.trim() || !tel.trim()) {
        popupErro.textContent = "Preciso do seu nome e WhatsApp para continuar.";
        popupErro.hidden = false;
        return;
      }
      var linhas = [pendingMsg || "Olá!", "", "Nome: " + nome.trim(),
        email.trim() ? "E-mail: " + email.trim() : null, "Telefone: " + tel.trim()].filter(Boolean);
      var url = "https://wa.me/" + FONE + "?text=" + encodeURIComponent(linhas.join("\n"));
      enviarPlanilha(nome.trim(), email.trim(), tel.trim());
      window.open(url, "_blank", "noopener,noreferrer");
      try { sessionStorage.setItem("popup_lead_enviado", "1"); } catch (err) {}
      fecharPopup();
    });
  }

  function wireExitIntent() {
    if (window.innerWidth < 900) return;
    var jaMostrou = false;
    try {
      jaMostrou = sessionStorage.getItem("popup_exit_mostrado") === "1" ||
        sessionStorage.getItem("popup_lead_enviado") === "1";
    } catch (err) {}
    if (jaMostrou) return;
    var onExit = function (ev) {
      if (ev.clientY > 0 || !popupOverlay.hidden) return;
      try { sessionStorage.setItem("popup_exit_mostrado", "1"); } catch (err) {}
      document.removeEventListener("mouseout", onExit);
      abrirPopup(
        "Oi, vim pelo site e quero orientação sobre o meu divórcio.",
        "Antes de você ir...",
        "Se ainda tem dúvidas, deixe seu contato — a gente te responde pelo WhatsApp."
      );
    };
    setTimeout(function () { document.addEventListener("mouseout", onExit); }, 8000);
  }
  wireExitIntent();

  // ---------- Balão flutuante (frases rotativas) ----------
  var balao = document.getElementById("balao");
  var balaoTitulo = document.getElementById("balao-titulo");
  var balaoSub = document.getElementById("balao-sub");
  var balaoClose = document.getElementById("balao-close");
  var frases = [
    { t: "Pensando em se divorciar?", s: "Fale com um advogado e entenda seus direitos antes de decidir." },
    { t: "Guarda dos filhos te preocupa?", s: "Entenda como funciona a guarda compartilhada e a convivência." },
    { t: "Não sabe se tem direito a pensão?", s: "Cada caso é diferente. Vamos conversar sobre o seu." },
    { t: "Partilha de bens te preocupa?", s: "Saiba o que cabe a cada um, de acordo com o regime do casamento." }
  ];
  var fraseIdx = 0, encerrado = false;
  if (balaoClose) {
    balaoClose.addEventListener("click", function (ev) {
      ev.preventDefault();
      ev.stopPropagation();
      encerrado = true;
      if (balao) balao.hidden = true;
    });
  }
  function girarFrases() {
    var visivel = [7000, 9000, 6500, 8000];
    var oculto = [5000, 11000, 7000, 14000];
    (function ciclo() {
      if (encerrado) return;
      var i = fraseIdx;
      setTimeout(function () {
        if (encerrado) return;
        if (balao) balao.hidden = true;
        setTimeout(function () {
          if (encerrado) return;
          fraseIdx = (fraseIdx + 1) % frases.length;
          var f = frases[fraseIdx];
          if (balaoTitulo) balaoTitulo.textContent = f.t;
          if (balaoSub) balaoSub.textContent = f.s;
          if (balao) balao.hidden = false;
          ciclo();
        }, oculto[i % oculto.length]);
      }, visivel[i % visivel.length]);
    })();
  }
  girarFrases();

  // ---------- Galeria / lightbox ----------
  var galeria = [
    { src: "uploads/webp/recepcao-1200.webp", fallback: "uploads/17-e1772128273241.jpg", titulo: "Recepção em Boituva/SP", legenda: "Rua Benedita Sanson Labronici, 180 — Chácara Labronici" },
    { src: "uploads/webp/equipe-foto-600.webp", fallback: "uploads/admin-ajax-1 (1).jpg", titulo: "A equipe", legenda: "Advogados e time de atendimento do escritório" },
    { src: "uploads/webp/sala-1200.webp", fallback: "uploads/19.jpg", titulo: "Sala de atendimento", legenda: "Atendimento presencial em Boituva ou reunião online" },
    { src: "uploads/webp/trabalho-1200.webp", fallback: "uploads/16.jpg", titulo: "Como trabalhamos", legenda: "Cada caso é analisado em conjunto pela equipe" }
  ];
  var lightbox = document.getElementById("lightbox");
  var lightboxImg = document.getElementById("lightbox-img");
  var lightboxTitulo = document.getElementById("lightbox-titulo");
  var lightboxLegenda = document.getElementById("lightbox-legenda");
  var lightboxCard = lightbox && lightbox.querySelector(".lb-card");
  var fecharTimer;
  function abrirGaleria(i) {
    var g = galeria[i];
    if (!g || !lightbox) return;
    lightboxImg.src = g.src;
    lightboxImg.alt = g.titulo;
    lightboxTitulo.textContent = g.titulo;
    lightboxLegenda.textContent = g.legenda;
    lightbox.hidden = false;
    lightbox.className = "lb";
    if (lightboxCard) lightboxCard.className = "lb-card";
  }
  function fecharGaleria() {
    if (!lightbox) return;
    lightbox.className = "lb lb-out";
    if (lightboxCard) lightboxCard.className = "lb-card lb-card-out";
    clearTimeout(fecharTimer);
    fecharTimer = setTimeout(function () { lightbox.hidden = true; }, 240);
  }
  document.querySelectorAll("[data-gallery-idx]").forEach(function (el) {
    el.addEventListener("click", function () { abrirGaleria(Number(el.getAttribute("data-gallery-idx"))); });
  });
  if (lightbox) lightbox.addEventListener("click", fecharGaleria);
  if (lightboxCard) lightboxCard.addEventListener("click", function (ev) { ev.stopPropagation(); });

  // ---------- Carrossel "Áreas de atuação" ----------
  var pcImgs = document.querySelectorAll("#pc-slides img");
  var pcTabs = document.querySelectorAll("#pc-tabs [data-pc-idx]");
  var pcIndex = 0, pcProgress = 0, pcInterval;
  function pcRender() {
    pcImgs.forEach(function (img, i) { img.style.opacity = i === pcIndex ? "1" : "0"; });
    pcTabs.forEach(function (btn, i) {
      btn.style.opacity = i === pcIndex ? "1" : "0.55";
      var bar = btn.querySelector(".pc-progress");
      if (!bar) return;
      bar.style.width = (i === pcIndex ? pcProgress : (i < pcIndex ? 100 : 0)) + "%";
    });
  }
  function pcStart() {
    clearInterval(pcInterval);
    pcInterval = setInterval(function () {
      pcProgress += 2;
      if (pcProgress >= 100) { pcProgress = 0; pcIndex = (pcIndex + 1) % pcImgs.length; }
      pcRender();
    }, 100);
  }
  pcTabs.forEach(function (btn, i) {
    btn.addEventListener("click", function () {
      pcIndex = i; pcProgress = 0; pcRender(); pcStart();
    });
  });
  if (pcImgs.length) { pcRender(); pcStart(); }

  // ---------- Carrossel "Vale a pena saber" ----------
  var vpsCards = [
    { numero: "01", titulo: "Divórcio consensual pode ser feito em cartório", texto: "Sem filhos menores ou incapazes, e com acordo sobre a partilha, o divórcio consensual pode ser feito diretamente em cartório, sem passar pelo juiz.", d: "M4 4h11l5 5v11H4V4zm11 1.5V9h3.5L15 5.5zM7 12h10v1.6H7V12zm0 3.4h10V17H7v-1.6zM7 8.6h6v1.6H7V8.6z" },
    { numero: "02", titulo: "Guarda compartilhada é a regra no Brasil", texto: "Mesmo sem acordo sobre outros pontos, a lei prioriza a guarda compartilhada, garantindo a convivência das crianças com os dois pais.", d: "M12 2a9.9 9.9 0 0 0-8.5 15L2 22l5.2-1.4A9.9 9.9 0 1 0 12 2zm0 18a8 8 0 0 1-4.1-1.1l-.3-.2-3 .8.8-2.9-.2-.3A8 8 0 1 1 12 20z" },
    { numero: "03", titulo: "Pensão alimentícia pode ser revisada", texto: "Mudou de emprego, teve outro filho ou a necessidade de quem recebe mudou? O valor da pensão pode ser revisto judicialmente a qualquer momento.", d: "M12 2l8 3.2v5.5c0 4.7-3.3 8.9-8 10.3-4.7-1.4-8-5.6-8-10.3V5.2L12 2zm-1 12.6l5-5-1.5-1.5-3.5 3.5-1.6-1.6L8 11.5l3 3.1z" },
    { numero: "04", titulo: "A partilha segue o regime do casamento", texto: "Comunhão parcial, total ou separação de bens: o regime escolhido no casamento define o que entra e o que fica de fora da partilha.", d: "M6 2h8l4 4v16H6V2zm7 1.5V7h3.5L13 3.5zM8 11h8v1.6H8V11zm0 3.4h8V16H8v-1.6zM8 7.6h3v1.6H8V7.6z" }
  ];
  var vpsIndex = 0, vpsInterval;
  var vpsNumeroEl = document.getElementById("vps-numero");
  var vpsTituloEl = document.getElementById("vps-titulo");
  var vpsTextoEl = document.getElementById("vps-texto");
  var vpsIconePath = document.getElementById("vps-icone-path");
  var vpsBarEl = document.getElementById("vps-bar");
  var vpsBgNumero = document.getElementById("vps-bg-numero");
  function vpsRender() {
    var c = vpsCards[vpsIndex];
    if (vpsNumeroEl) vpsNumeroEl.textContent = c.numero + " / 04";
    if (vpsBgNumero) vpsBgNumero.textContent = c.numero;
    if (vpsTituloEl) vpsTituloEl.textContent = c.titulo;
    if (vpsTextoEl) vpsTextoEl.textContent = c.texto;
    if (vpsIconePath) vpsIconePath.setAttribute("d", c.d);
    if (vpsBarEl) vpsBarEl.style.height = ((vpsIndex + 1) / vpsCards.length * 100) + "%";
  }
  function vpsStart() {
    clearInterval(vpsInterval);
    vpsInterval = setInterval(function () { vpsIndex = (vpsIndex + 1) % vpsCards.length; vpsRender(); }, 6500);
  }
  var vpsPrevBtn = document.querySelector('[data-action="vps-prev"]');
  var vpsNextBtn = document.querySelector('[data-action="vps-next"]');
  if (vpsPrevBtn) vpsPrevBtn.addEventListener("click", function () {
    vpsIndex = (vpsIndex + vpsCards.length - 1) % vpsCards.length; vpsRender(); vpsStart();
  });
  if (vpsNextBtn) vpsNextBtn.addEventListener("click", function () {
    vpsIndex = (vpsIndex + 1) % vpsCards.length; vpsRender(); vpsStart();
  });
  if (vpsNumeroEl) { vpsRender(); vpsStart(); }

  // ---------- Mapa do Brasil (carregado só quando a seção se aproxima) ----------
  var mapaHost = document.querySelector("mapa-brasil");
  if (mapaHost && "IntersectionObserver" in window) {
    var mapaIo = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (!en.isIntersecting) return;
        mapaIo.disconnect();
        var s = document.createElement("script");
        s.src = "./mapa-brasil.js";
        document.body.appendChild(s);
      });
    }, { rootMargin: "300px 0px" });
    mapaIo.observe(mapaHost);
  } else if (mapaHost) {
    var s2 = document.createElement("script");
    s2.src = "./mapa-brasil.js";
    document.body.appendChild(s2);
  }

  // ---------- Reveal ao rolar (idêntico ao comportamento original) ----------
  function setupReveal() {
    var sel = ".h2, .sec > div > div > p, .sec > div > p, .grid3 > div, .grid3 > img, .hero-img, .hero-img + div, .sec details, .sec a[href^='https://wa.me'], .sec > div > div > div, footer > div";
    var groups = Array.from(document.querySelectorAll("section, footer"));
    groups.forEach(function (g) {
      var els = Array.from(g.querySelectorAll(sel)).filter(function (e, i, a) {
        return a.indexOf(e) === i && !e.closest(".mq") && !e.closest(".hero-in");
      });
      els.forEach(function (el, i) {
        el.classList.add("reveal");
        el.style.transitionDelay = Math.min(i, 4) * 45 + "ms";
      });
    });
    var all = Array.from(document.querySelectorAll(".reveal"));
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (en) {
        if (en.isIntersecting) { en.target.classList.add("in"); io.unobserve(en.target); }
      });
    }, { rootMargin: "0px 0px 15% 0px", threshold: 0 });
    all.forEach(function (el) { io.observe(el); });
    var podeRolar = document.documentElement.scrollHeight - window.innerHeight > 40;
    setTimeout(function () { all.forEach(function (el) { el.classList.add("in"); }); }, podeRolar ? 3000 : 80);
  }
  setupReveal();
})();
