# Integração dos formulários com Google Sheets

Os dois formulários da landing (o da seção **Análise gratuita** e o do **popup**) enviam
os mesmos campos:

| Campo enviado    | Origem no formulário |
|------------------|----------------------|
| `nome`           | Nome completo |
| `email`          | Email |
| `whatsapp`       | WhatsApp |
| `especialidade`  | Especialidade (select) |
| `pacientes_mes`  | Pacientes/mês (select) |
| `origem_form`    | `modal` ou `secao_analise` |
| `utm_source`, `utm_medium`, `utm_campaign`, `utm_term`, `utm_content`, `gclid`, `fbclid` | capturados da URL (first-touch, guardados na sessão) |
| `pagina`         | URL onde o lead preencheu |

O envio é feito por GET disfarçado de imagem (`new Image().src`), que não sofre bloqueio
de CORS do Google e funciona dentro de iframe. Há um `fetch(..., {mode:'no-cors'})` como
reforço. Como não esperamos resposta, o redirecionamento para o WhatsApp é imediato.
Há trava de 4 segundos contra clique duplo, para não duplicar linha na planilha.

## 1. Publicar o Apps Script

Na planilha: **Extensões → Apps Script**. Cole o código abaixo, ajuste as três constantes
do topo e publique em **Implantar → Nova implantação → App da Web**:

- Executar como: **eu**
- Quem pode acessar: **qualquer pessoa**

Copie a URL que termina em `/exec`.

## 2. Colar a URL na landing

Já está configurado com:

```
https://script.google.com/macros/s/AKfycbzqLdnJWGEY1hYPVpeBH5udSqOPAHf3uYLVxKR8wp86PVsUvDazDPHSPTXJV4DrqgY/exec
```

Para trocar, use o campo **endpointPlanilha** no painel de Tweaks da landing.
Se o campo ficar vazio, o formulário continua funcionando (abre o WhatsApp),
apenas não grava na planilha.

> Ao republicar o Apps Script, escolha **Gerenciar implantações → editar → Nova versão**
> para manter a mesma URL. Uma "Nova implantação" gera outra URL e é preciso
> atualizar o campo aqui.

## 3. Código do Apps Script

```js
var EMAIL_AVISO = 'rastajohny091@gmail.com,caioanderle30@gmail.com';
var PLANILHA_ID = 'COLE_AQUI_O_ID_DA_PLANILHA';
var FUSO = 'America/Sao_Paulo';

var COLUNAS = ['Data','Nome','Email','WhatsApp','Especialidade','Pacientes/mes',
               'Origem do form','utm_source','utm_medium','utm_campaign',
               'utm_term','utm_content','gclid','fbclid','Pagina','Notificacao'];

function doGet(e) {
  var p = (e && e.parameter) ? e.parameter : {};
  if (p.nome || p.email || p.whatsapp) return salvarLead(p);
  return ContentService.createTextOutput('ADR Marketing - endpoint ativo');
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
        .setFontWeight('bold').setBackground('#1a9646').setFontColor('#ffffff');
      sh.setFrozenRows(1);
    }

    var nome  = (d.nome || '').toString().trim();
    var email = (d.email || '').toString().trim();
    var whats = (d.whatsapp || '').toString().trim();

    // ignora duplicado: mesmo WhatsApp nos ultimos 2 minutos
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
      d.especialidade || '', d.pacientes_mes || '', d.origem_form || '',
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

  var FUNDO = '#000000', CARTAO = '#0d0d0d', BORDA = '#242424', VERDE = '#1a9646';

  function esc(v) {
    return String(v == null ? '' : v)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
  }

  // bgcolor em ATRIBUTO: e o que sobrevive quando o Gmail remove o CSS de fundo
  function linha(rotulo, valor, href, ultima) {
    if (!valor) return '';
    var borda = ultima ? '' : 'border-bottom:1px solid ' + BORDA + ';';
    var conteudo = href
      ? '<a href="' + esc(href) + '" style="color:#6fd894;text-decoration:underline;word-break:break-all;">' + esc(valor) + '</a>'
      : '<span style="color:#ffffff;font-weight:bold;word-break:break-word;">' + esc(valor) + '</span>';
    return '<tr>' +
      '<td bgcolor="' + CARTAO + '" style="padding:14px 20px;' + borda + 'font:14px Arial,sans-serif;color:#8d8d93;vertical-align:top;width:36%;background:' + CARTAO + ';">' + esc(rotulo) + '</td>' +
      '<td bgcolor="' + CARTAO + '" style="padding:14px 20px;' + borda + 'font:14px Arial,sans-serif;color:#ffffff;vertical-align:top;background:' + CARTAO + ';">' + conteudo + '</td>' +
      '</tr>';
  }

  var linhas =
    linha('Nome', nome) +
    linha('E-mail', email, 'mailto:' + email) +
    linha('WhatsApp', whats, link || null) +
    linha('Especialidade', d.especialidade) +
    linha('Pacientes/mes', d.pacientes_mes) +
    linha('Formulario', d.origem_form) +
    linha('Origem', origem || 'acesso direto') +
    linha('Pagina', d.pagina, d.pagina) +
    linha('Recebido em', quando, null, true);

  // botao centralizado sem tabela aninhada: align no td + anchor inline-block
  var botao = link
    ? '<tr><td align="center" bgcolor="' + CARTAO + '" style="padding:28px 20px 10px;text-align:center;background:' + CARTAO + ';">' +
        '<a href="' + esc(link) + '" bgcolor="' + VERDE + '" style="display:inline-block;background:' + VERDE + ';padding:16px 34px;font:bold 15px Arial,sans-serif;color:#ffffff;text-decoration:none;border-radius:10px;">' +
        'Chamar ' + esc(primeiro || 'o lead') + ' no WhatsApp</a>' +
        '</td></tr>'
    : '';

  var html =
  '<!DOCTYPE html><html><head><meta charset="utf-8">' +
  '<meta name="viewport" content="width=device-width,initial-scale=1">' +
  '<meta name="color-scheme" content="dark">' +
  '<meta name="supported-color-schemes" content="dark"></head>' +
  '<body bgcolor="' + FUNDO + '" style="margin:0;padding:0;background:' + FUNDO + ';">' +
  '<div style="display:none;max-height:0;overflow:hidden;">Novo lead: ' + esc(nome) + ' - ' + esc(d.especialidade || 'area da saude') + '</div>' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + FUNDO + '" style="background:' + FUNDO + ';">' +
  '<tr><td align="center" bgcolor="' + FUNDO + '" style="padding:24px 12px;background:' + FUNDO + ';">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + CARTAO + '" style="max-width:520px;background:' + CARTAO + ';border-radius:16px;overflow:hidden;">' +

  // cabecalho verde, titulo branco
  '<tr><td bgcolor="' + VERDE + '" style="padding:26px 20px;background:' + VERDE + ';">' +
  '<div style="font:bold 11px Arial,sans-serif;letter-spacing:2.5px;color:#ffffff;text-transform:uppercase;">ADR Marketing</div>' +
  '<div style="font:bold 30px Arial,sans-serif;color:#ffffff;padding-top:6px;letter-spacing:-0.5px;">NOVO LEAD</div>' +
  '<div style="font:14px Arial,sans-serif;color:#ffffff;padding-top:8px;line-height:1.5;">Um novo contato preencheu o formulario do site.</div>' +
  '</td></tr>' +

  '<tr><td bgcolor="' + CARTAO + '" style="padding:0;background:' + CARTAO + ';">' +
  '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" bgcolor="' + CARTAO + '" style="background:' + CARTAO + ';">' +
  linhas +
  botao +
  '<tr><td align="center" bgcolor="' + CARTAO + '" style="padding:16px 20px 28px;text-align:center;background:' + CARTAO + ';">' +
  '<a href="' + esc(planilha) + '" style="font:13px Arial,sans-serif;color:#9aa4b0;text-decoration:underline;">Ver todos os leads na planilha</a>' +
  '</td></tr>' +
  '</table></td></tr>' +

  '</table>' +
  '<div style="font:11px Arial,sans-serif;color:#6a6a70;padding-top:16px;text-align:center;">Aviso automatico - ADR Marketing</div>' +
  '</td></tr></table></body></html>';

  var texto = 'NOVO LEAD\n\nNome: ' + (nome || '-') +
    '\nEmail: ' + (email || '-') +
    '\nWhatsApp: ' + (whats || '-') +
    '\nEspecialidade: ' + (d.especialidade || '-') +
    '\nPacientes/mes: ' + (d.pacientes_mes || '-') +
    '\nFormulario: ' + (d.origem_form || '-') +
    '\nOrigem: ' + (origem || '-') +
    '\nPagina: ' + (d.pagina || '-') +
    '\nRecebido em: ' + quando +
    (link ? '\n\nAbrir conversa: ' + link : '');

  var assunto = 'NOVO LEAD - ' + (nome || 'sem nome') + (d.especialidade ? ' (' + d.especialidade + ')' : '');
  var res = [];
  for (var i = 0; i < lista.length; i++) {
    try {
      MailApp.sendEmail({ to: lista[i], subject: assunto, body: texto, htmlBody: html, name: 'ADR Marketing' });
      res.push('OK ' + lista[i]);
    } catch (e1) {
      try {
        GmailApp.sendEmail(lista[i], assunto, texto, { htmlBody: html, name: 'ADR Marketing' });
        res.push('OK(gmail) ' + lista[i]);
      } catch (e2) { res.push('FALHOU ' + lista[i] + ' (' + e2 + ')'); }
    }
  }
  return res.join(' | ');
}
function testar() {
  Logger.log(salvarLead({
    nome: 'Teste ADR', email: 'teste@teste.com', whatsapp: '48999999999',
    especialidade: 'Clinica odontologica', pacientes_mes: '20 a 50 pacientes',
    origem_form: 'modal', utm_source: 'google', utm_medium: 'cpc',
    utm_campaign: 'implante', pagina: 'https://agenciaadrmarketing.com/'
  }).getContent());
}
```

## Observações

- Rode `testar()` no editor do Apps Script antes de publicar: ele grava uma linha de
  exemplo e mostra se o e-mail de aviso saiu.
- Se trocar as opções dos selects na landing, não precisa mexer no script — os valores
  chegam como texto livre.
- A coluna **Notificacao** registra se o e-mail de aviso foi enviado, útil para depurar.
