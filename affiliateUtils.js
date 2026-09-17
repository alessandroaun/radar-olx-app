// =====================================================================
// AFILIADOS MERCADO LIVRE (CONFIGURAÇÃO OFICIAL DESACOPLADA)
// =====================================================================
export const ML_AFFILIATE_CONFIG = {
  tool: '58245087',
  word: 'alessandrouchoadonascimento'
};

/**
 * Formata qualquer URL do Mercado Livre para conter os parâmetros de afiliado oficiais.
 * Preserva fragmentos de URL (#) e respeita URLs já formatadas.
 */
export function formatarUrlAfiliado(url) {
  if (!url) return '';
  const urlStr = String(url).trim();
  const lower = urlStr.toLowerCase();
  if (lower.includes('mercadolivre.com') || lower.includes('meli.la')) {
    if (lower.includes('matt_tool=')) return urlStr;
    const hasFrag = urlStr.includes('#');
    const parts = hasFrag ? urlStr.split('#') : [urlStr, ''];
    const base = parts[0];
    const frag = parts[1];
    const sep = base.includes('?') ? '&' : '?';
    const finalBase = base + sep + 'matt_tool=' + ML_AFFILIATE_CONFIG.tool + '&matt_word=' + ML_AFFILIATE_CONFIG.word + '&forceInApp=true';
    return hasFrag ? (finalBase + '#' + frag) : finalBase;
  }
  return urlStr;
}

export default formatarUrlAfiliado;