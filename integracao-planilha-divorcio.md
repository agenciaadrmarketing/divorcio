# Integração do popup (Divórcio) com Google Sheets

Planilha: https://docs.google.com/spreadsheets/d/1f6t-K2T-mHii6PzwU9GOONq0vy4R-4D92Z-S6oKSybg/edit

Cole o código abaixo no Apps Script dessa planilha (Extensões → Apps Script), rode `testar()` uma vez, depois Implantar → Nova implantação → App da Web (Executar como: você; Acesso: qualquer pessoa) e me envie a URL `/exec` gerada — preciso dela para conectar ao popup do site.

```js
var EMAIL_AVISO = 'recjohny-091@gmail.com,agencia.adrmarketing@gmail.com';
var PLANILHA_ID = '1f6t-K2T-mHii6PzwU9GOONq0vy4R-4D92Z-S6oKSybg';
var FUSO = 'America/Sao_Paulo';

var COLUNAS = ['Data','Nome','Email','WhatsApp','Mensagem','Origem do form',
               'utm_source','utm_medium','utm_campaign','utm_term','utm_content',
               'gclid','fbclid','Pagina','Notificacao'];

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.nome || p.email || p.whatsapp) return salvarLead(p);
  return ContentService.createTextOutput('Vieira & Marques - endpoint ativo');
}

function doPost(e) {
  var d = {};
  try { d = JSON.parse(e.postData.contents); }
  catch (err) { d = (e && e.parameter) ? e.parameter : {}; }
  return salvarLead(d);
}

function salvarLead(d) {
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var sh = SpreadsheetApp.openById(PLANILHA_ID).getSheets()[0];

    if (sh.getLastRow() === 0) {
      sh.appendRow(COLUNAS);
      sh.getRange(1, 1, 1, COLUNAS.length)
        .setFontWeight('bold').setBackground('#0B0B0B').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }

    var nome  = (d.nome || '').toString().trim();
    var email = (d.email || '').toString().trim();
    var whats = (d.whatsapp || '').toString().trim();

    var last = sh.getLastRow();
    if (last > 1 && whats) {
      var check = sh.getRange(Math.max(2, last - 4), 1, Math.min(5, last - 1), 4).getValues();
      for (var i = 0; i < check.length; i++) {
        var quando = check[i][0], fone = (check[i][3] || '').toString().trim();
        if (fone === whats && quando instanceof Date && (new Date() - quando) < 120000) {
          return ContentService.createTextOutput('duplicado');
        }
      }
    }

    var agora = new Date();
    sh.appendRow([agora, nome, email, whats,
      d.mensagem || '', d.origem_form || '',
      d.utm_source || '', d.utm_medium || '', d.utm_campaign || '',
      d.utm_term || '', d.utm_content || '', d.gclid || '', d.fbclid || '',
      d.pagina || '', '']);

    var linha = sh.getLastRow(), resultado = '';
    try { resultado = notificar(nome, email, whats, d, agora); }
    catch (errMail) { resultado = 'ERRO: ' + errMail; }
    sh.getRange(linha, COLUNAS.length).setValue(resultado);

    return ContentService.createTextOutput('ok');
  } catch (err) {
    return ContentService.createTextOutput('erro: ' + err);
  } finally {
    try { lock.releaseLock(); } catch (e2) {}
  }
}

function notificar(nome, email, whats, d, agora) {
  var lista = EMAIL_AVISO.split(',').map(function (x) { return x.trim(); })
    .filter(function (x) { return x.indexOf('@') > 0; });
  if (!lista.length) return 'sem destinatarios';

  var digitos = whats.replace(/\D/g, '');
  var link = digitos ? 'https://wa.me/' + (digitos.length <= 11 ? '55' + digitos : digitos) : '';
  var quando = Utilities.formatDate(agora, FUSO, "dd/MM/yyyy 'as' HH:mm");
  var origem = [d.utm_source, d.utm_medium, d.utm_campaign].filter(String).join(' / ');
  var planilha = 'https://docs.google.com/spreadsheets/d/' + PLANILHA_ID + '/edit';
  var primeiro = (nome || '').split(' ')[0];

  var FUNDO = '#0B0B0B', CARTAO = '#141414', BORDA = '#2A2A2A', VERDE = '#1EA94F';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  function linhaHtml(rotulo, valor, href, ultima) {
    if (!valor) return '';
    var borda = ultima ? '' : 'border-bottom:1px solid ' + BORDA + ';';
    var conteudo = href
      ? '<a href="' + esc(href) + '" style="color:#6fe89a;text-decoration:underline;word-break:break-all;">' + esc(valor) + '</a>'
      : '<span style="color:#ffffff;font-weight:bold;word-break:break-word;">' + esc(valor) + '</span>';
    return '<tr>' +
      '<td bgcolor="' + CARTAO + '" style="padding:14px 20px;' + borda + 'font:14px Arial,sans-serif;color:#8d8d93;vertical-align:top;width:34%;background:' + CARTAO + ';">' + esc(rotulo) + '</td>' +
      '<td bgcolor="' + CARTAO + '" style="padding:14px 20px;' + borda + 'font:14px Arial,sans-serif;color:#ffffff;vertical-align:top;background:' + CARTAO + ';">' + conteudo + '</td>' +
      '</tr>';
  }

  var linhas =
    linhaHtml('Nome', nome) +
    linhaHtml('E-mail', email, email ? 'mailto:' + email : null) +
    linhaHtml('WhatsApp', whats, link || null) +
    linhaHtml('Mensagem', d.mensagem) +
    linhaHtml('Origem', origem || 'acesso direto') +
    linhaHtml('Pagina', d.pagina, d.pagina) +
    linhaHtml('Recebido em', quando, null, true);

  var botao = link
    ? '<tr><td align="center" bgcolor="' + CARTAO + '" style="padding:28px 20px 10px;text-align:center;background:' + CARTAO + ';">' +
        '<a href="' + esc(link) + '" style="display:inline-block;background:' + VERDE + ';padding:16px 34px;font:bold 15px Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">' +
        'Chamar ' + esc(primeiro || 'o lead') + ' no WhatsApp</a>' +
        '</td></tr>'
    : '';

  var html =
  '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1"></head>' +
  '<body bgcolor="' + FUNDO + '" style="margin:0;padding:0;background:' + FUNDO + ';">' +
  '<div style="display:none;max-height:0;overflow:hidden;">Novo lead: ' + esc(nome) + '</div>' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + FUNDO + '" style="background:' + FUNDO + ';">' +
  '<tr><td align="center" bgcolor="' + FUNDO + '" style="padding:24px 12px;background:' + FUNDO + ';">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + CARTAO + '" style="max-width:520px;background:' + CARTAO + ';border-radius:16px;overflow:hidden;">' +
  '<tr><td bgcolor="' + VERDE + '" style="padding:26px 20px;background:' + VERDE + ';">' +
  '<div style="font:bold 11px Arial,sans-serif;letter-spacing:2.5px;color:#ffffff;text-transform:uppercase;">Vieira &amp; Marques</div>' +
  '<div style="font:bold 30px Arial,sans-serif;color:#ffffff;padding-top:6px;letter-spacing:-0.5px;">NOVO LEAD</div>' +
  '<div style="font:14px Arial,sans-serif;color:#ffffff;padding-top:8px;line-height:1.5;">Um visitante preencheu o popup do site sobre divórcio.</div>' +
  '</td></tr>' +
  '<tr><td bgcolor="' + CARTAO + '" style="padding:0;background:' + CARTAO + ';">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + CARTAO + '" style="background:' + CARTAO + ';">' +
  linhas + botao +
  '<tr><td align="center" bgcolor="' + CARTAO + '" style="padding:16px 20px 28px;text-align:center;background:' + CARTAO + ';">' +
  '<a href="' + esc(planilha) + '" style="font:13px Arial,sans-serif;color:#9aa4b0;text-decoration:underline;">Ver todos os leads na planilha</a>' +
  '</td></tr></table></td></tr></table>' +
  '<div style="font:11px Arial,sans-serif;color:#6a6a70;padding-top:16px;text-align:center;">Aviso automatico - Vieira &amp; Marques</div>' +
  '</td></tr></table></body></html>';

  var texto = 'NOVO LEAD\n\nNome: ' + (nome || '-') +
    '\nEmail: ' + (email || '-') +
    '\nWhatsApp: ' + (whats || '-') +
    '\nMensagem: ' + (d.mensagem || '-') +
    '\nOrigem: ' + (origem || '-') +
    '\nPagina: ' + (d.pagina || '-') +
    '\nRecebido em: ' + quando +
    (link ? '\n\nAbrir conversa: ' + link : '');

  var assunto = 'NOVO LEAD (Divórcio) - Vieira & Marques - ' + (nome || 'sem nome');
  var res = [];
  for (var i = 0; i < lista.length; i++) {
    try {
      MailApp.sendEmail({ to: lista[i], subject: assunto, body: texto, htmlBody: html, name: 'Vieira & Marques' });
      res.push('OK ' + lista[i]);
    } catch (e1) {
      try {
        GmailApp.sendEmail(lista[i], assunto, texto, { htmlBody: html, name: 'Vieira & Marques' });
        res.push('OK(gmail) ' + lista[i]);
      } catch (e2) { res.push('FALHOU ' + lista[i] + ' (' + e2 + ')'); }
    }
  }
  return res.join(' | ');
}

function testar() {
  Logger.log(salvarLead({
    nome: 'Teste', email: 'teste@teste.com', whatsapp: '15999999999',
    mensagem: 'Oi, quero orientação sobre o meu divórcio.',
    origem_form: 'popup', pagina: 'https://vieiraemarquesadvogados.com/divorcio/'
  }).getContent());
}
```

## Last sync
Aguardando: usuário implantar o Apps Script e enviar a URL `/exec` para eu atualizar `endpointPlanilha` em Divorcio.dc.html.
