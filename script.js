// ===========================================
// CONFIGURAÇÕES
// ===========================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbz4XYGOaJPDKBsI3Jv9nTaaSp6jWcza3Y_qpxgSoJ4IkCNClKAJ2kxoGKxwSiZCZGRGfA/exec';

// ===========================================
// VARIÁVEIS GLOBAIS
// ===========================================
let resultados = {
    custoDireto: 0,
    custoTotal: 0,
    custoParcelamento: 0,
    precoPiso: 0,
    precoAlvo: 0,
    precoPremium: 0,
    margemPiso: 0,
    margemAlvo: 0,
    margemPremium: 0,
    margemLiquida: 0,
    impostos: 0,
    cs: 0,
    parceiro: 0,
    receitaLiquida: 0,
    margemLiquidaR$: 0,
    perfis: []
};

let editandoId = null;
let syncTimeout = null;
let syncQueue = [];
let isOnline = false;
let historicoCompleto = [];
let salvando = false;
let ultimoSalvamento = 0;

// ===========================================
// INICIALIZAÇÃO
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    configurarAutoSave();
    atualizarBufferPerfis();
    atualizarCustosBase();
    setTimeout(calcularPrecos, 500);
    testarConexao();
    setInterval(testarConexaoSilenciosa, 30000);
    setInterval(atualizarContadorAutoSave, 1000);
    
    window.addEventListener('online', function() {
        mostrarNotificacao('Conexão restabelecida! Sincronizando...', 'success');
        processarFilaSincronizacao();
    });
});

function atualizarContadorAutoSave() {
    const contador = document.getElementById('contadorAutoSave');
    if (syncTimeout) {
        const segundosRestantes = Math.ceil(syncTimeout._idleTimeout / 1000);
        contador.textContent = `⏳ Auto-save em ${segundosRestantes}s`;
    } else {
        contador.textContent = '';
    }
}

// ===========================================
// FUNÇÕES DE CONFIGURAÇÃO
// ===========================================
function configurarAutoSave() {
    document.querySelectorAll('input, select, textarea').forEach(element => {
        element.addEventListener('input', agendarSincronizacaoAutomatica);
        element.addEventListener('change', function() {
            if (this.id === 'complexidade' || this.id === 'urgencia') {
                atualizarBufferPerfis();
            }
            if (this.id === 'tem_parceiro') {
                toggleParceiro();
            }
            if (this.id === 'aplica_cs') {
                toggleCS();
            }
            agendarSincronizacaoAutomatica();
        });
    });
    
    document.querySelectorAll('input[name="modelo_cobranca"]').forEach(radio => {
        radio.addEventListener('change', agendarSincronizacaoAutomatica);
    });
}

function showTab(tabName, element) {
    document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
    
    document.getElementById(`tab-${tabName}`).classList.add('active');
    element.classList.add('active');
    
    if (tabName === 'historico') carregarHistoricoDoGoogle();
}

// ===========================================
// FUNÇÕES DE NOTIFICAÇÃO E STATUS
// ===========================================
function mostrarNotificacao(mensagem, tipo = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${tipo}`;
    notification.textContent = mensagem;
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 5000);
}

function atualizarStatusSincronizacao(status, mensagem) {
    const dot = document.getElementById('syncDot');
    const text = document.getElementById('syncText');
    
    dot.className = `sync-dot ${status}`;
    
    if (status === 'online') {
        text.textContent = mensagem || 'Online';
        isOnline = true;
    } else if (status === 'syncing') {
        text.textContent = mensagem || 'Sincronizando...';
    } else {
        text.textContent = mensagem || 'Offline';
        isOnline = false;
    }
}

// ===========================================
// FUNÇÕES DE SINCRONIZAÇÃO
// ===========================================
function agendarSincronizacaoAutomatica() {
    if (syncTimeout) {
        clearTimeout(syncTimeout);
    }
    
    calcularPrecos();
    
    syncTimeout = setTimeout(() => {
        if (isOnline) {
            enviarParaGoogleSheets(true);
        } else {
            adicionarFilaSincronizacao();
            atualizarStatusSincronizacao('offline', 'Offline - Pendente');
            mostrarNotificacao('Offline. Dados serão sincronizados quando online.', 'warning');
        }
    }, 3000);
}

function adicionarFilaSincronizacao() {
    const dadosAtuais = coletarDadosCompletos();
    
    const ultimoItem = syncQueue[syncQueue.length - 1];
    if (ultimoItem && JSON.stringify(ultimoItem.dados) === JSON.stringify(dadosAtuais)) {
        return;
    }
    
    syncQueue.push({
        timestamp: new Date().toISOString(),
        dados: dadosAtuais
    });
    
    if (syncQueue.length > 20) syncQueue = syncQueue.slice(-20);
    localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
}

async function processarFilaSincronizacao() {
    if (syncQueue.length === 0 || salvando) return;
    
    salvando = true;
    atualizarStatusSincronizacao('syncing', `Sincronizando ${syncQueue.length}...`);
    
    const itensParaProcessar = [...syncQueue];
    let sucessos = 0, erros = 0;
    
    for (const item of itensParaProcessar) {
        try {
            await enviarDadosParaGoogle(item.dados, true);
            sucessos++;
            syncQueue = syncQueue.filter(q => q.timestamp !== item.timestamp);
            await delay(500);
        } catch (error) {
            erros++;
        }
    }
    
    localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
    salvando = false;
    
    if (erros === 0) {
        atualizarStatusSincronizacao('online', 'Sincronizado');
        if (sucessos > 0) {
            mostrarNotificacao(`${sucessos} ${sucessos === 1 ? 'item' : 'itens'} sincronizado${sucessos === 1 ? '' : 's'}!`, 'success');
        }
    } else {
        atualizarStatusSincronizacao('online', 'Parcial');
        mostrarNotificacao(`${sucessos} sucessos, ${erros} erros`, 'warning');
    }
}

function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function testarConexaoSilenciosa() {
    if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL === 'SUA_URL_DO_WEB_APP_AQUI') {
        atualizarStatusSincronizacao('offline', 'Não configurado');
        return;
    }
    
    fetch(GOOGLE_SHEETS_URL + '?action=test')
        .then(response => {
            if (response.ok) {
                atualizarStatusSincronizacao('online', 'Sincronizado');
                isOnline = true;
                
                const savedQueue = localStorage.getItem('syncQueue');
                if (savedQueue) {
                    syncQueue = JSON.parse(savedQueue);
                    if (syncQueue.length > 0) processarFilaSincronizacao();
                }
            } else {
                atualizarStatusSincronizacao('offline', 'Offline');
                isOnline = false;
            }
        })
        .catch(() => {
            atualizarStatusSincronizacao('offline', 'Offline');
            isOnline = false;
        });
}

function testarConexao() {
    if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL === 'SUA_URL_DO_WEB_APP_AQUI') {
        mostrarNotificacao('URL do Google Sheets não configurada!', 'error');
        atualizarStatusSincronizacao('offline', 'Não configurado');
        return;
    }
    
    fetch(GOOGLE_SHEETS_URL + '?action=test')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                atualizarStatusSincronizacao('online', 'Sincronizado');
                mostrarNotificacao('Conexão estabelecida!', 'success');
                
                const savedQueue = localStorage.getItem('syncQueue');
                if (savedQueue) {
                    syncQueue = JSON.parse(savedQueue);
                    if (syncQueue.length > 0) processarFilaSincronizacao();
                }
            } else {
                atualizarStatusSincronizacao('offline', 'Offline');
                mostrarNotificacao('Erro ao conectar', 'error');
            }
        })
        .catch(error => {
            atualizarStatusSincronizacao('offline', 'Offline');
            mostrarNotificacao('Falha na conexão: ' + error.message, 'error');
        });
}

// ===========================================
// FUNÇÃO PARA RECRIAR CABEÇALHO
// ===========================================
function recriarCabecalho() {
    if (!confirm('Isso irá recriar o cabeçalho da planilha. Os dados existentes serão preservados. Continuar?')) {
        return;
    }
    
    mostrarNotificacao('Recriando cabeçalho...', 'info');
    
    fetch(GOOGLE_SHEETS_URL + '?action=recriarCabecalho')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                mostrarNotificacao('Cabeçalho recriado com sucesso!', 'success');
                carregarHistoricoDoGoogle();
            } else {
                mostrarNotificacao('Erro ao recriar cabeçalho: ' + (data.error || 'Erro desconhecido'), 'error');
            }
        })
        .catch(error => {
            mostrarNotificacao('Erro ao recriar cabeçalho: ' + error.message, 'error');
        });
}

// ===========================================
// FUNÇÕES DE ATUALIZAÇÃO DE TABELAS
// ===========================================
function atualizarCustosBase() {
    const overheadHora = parseFloat(document.getElementById('overhead_hora')?.value || 20);
    
    const perfis = ['estagio', 'jr', 'pl', 'sr', 'coord', 'socio'];
    perfis.forEach(perfil => {
        const custo = parseFloat(document.getElementById(`custo_${perfil}`)?.value || 0);
        const horas = parseFloat(document.getElementById(`horas_${perfil}`)?.value || 150);
        const custoBase = custo / horas;
        document.getElementById(`custo_base_${perfil}`).textContent = 'R$ ' + custoBase.toFixed(2).replace('.', ',');
        
        const custoCompleto = custoBase + overheadHora;
        document.getElementById(`custo_completo_${perfil}`).textContent = 'R$ ' + custoCompleto.toFixed(2).replace('.', ',');
    });
}

function atualizarTabelas() {
    atualizarCustosBase();
    mostrarNotificacao('Parâmetros atualizados!', 'success');
    calcularPrecos();
    agendarSincronizacaoAutomatica();
}

// ===========================================
// FUNÇÕES DE COLETA DE DADOS
// ===========================================
function coletarDadosCompletos() {
    const resultadosAtuais = calcularPrecos();
    
    const dadosInput = {
        cliente: document.getElementById('cliente_nome').value,
        segmento: document.getElementById('segmento').value,
        tipo: document.getElementById('tipo_cliente').value,
        risco: document.getElementById('risco_inadimplencia').value,
        produto: document.getElementById('produto').value,
        escopo: document.getElementById('escopo').value,
        complexidade: document.getElementById('complexidade').value,
        urgencia: document.getElementById('urgencia').value,
        modeloCobranca: document.querySelector('input[name="modelo_cobranca"]:checked')?.value || 'Hora',
        entrada: parseFloat(document.getElementById('entrada').value) || 0,
        parcelas: parseInt(document.getElementById('parcelas').value) || 6,
        desconto: parseFloat(document.getElementById('desconto').value) || 0,
        temParceiro: document.getElementById('tem_parceiro').value,
        percentualParceiro: document.getElementById('tem_parceiro').value === 'sim' ? 
            parseFloat(document.getElementById('percentual_parceiro').value) || 0 : 0,
        aplicaCS: document.getElementById('aplica_cs').value,
        percentualCS: document.getElementById('aplica_cs').value === 'sim' ? 
            parseFloat(document.getElementById('percentual_cs').value) || 7.5 : 0
    };
    
    let perfisArray = [];
    document.querySelectorAll('.perfil-row').forEach(row => {
        perfisArray.push({
            nome: row.querySelector('.perfil-nome').value,
            horas: parseFloat(row.querySelector('.perfil-horas').value) || 0
        });
    });
    
    return {
        action: 'salvar',
        timestamp: new Date().toISOString(),
        input: dadosInput,
        perfis: perfisArray,
        resultados: {
            custoDireto: resultadosAtuais.custoDireto,
            custoTotal: resultadosAtuais.custoTotal,
            custoParcelamento: resultadosAtuais.custoParcelamento,
            precoPiso: resultadosAtuais.precoPiso,
            precoAlvo: resultadosAtuais.precoAlvo,
            precoPremium: resultadosAtuais.precoPremium,
            margemPiso: resultadosAtuais.margemPiso,
            margemAlvo: resultadosAtuais.margemAlvo,
            margemPremium: resultadosAtuais.margemPremium,
            margemLiquida: resultadosAtuais.margemLiquida,
            impostos: resultadosAtuais.impostos,
            cs: resultadosAtuais.cs,
            parceiro: resultadosAtuais.parceiro,
            receitaLiquida: resultadosAtuais.receitaLiquida
        }
    };
}

// ===========================================
// FUNÇÕES DE ENVIO PARA GOOGLE SHEETS
// ===========================================
async function enviarDadosParaGoogle(dadosCompletos, isAutoSave = false) {
    if (salvando) {
        console.log('Já está salvando, ignorando...');
        return;
    }
    
    const agora = Date.now();
    if (agora - ultimoSalvamento < 2000) {
        console.log('Salvamento muito recente, ignorando...');
        return;
    }
    
    salvando = true;
    
    return new Promise((resolve, reject) => {
        fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosCompletos)
        })
        .then(() => {
            ultimoSalvamento = Date.now();
            if (!isAutoSave) {
                mostrarNotificacao('✅ Dados salvos com sucesso!', 'success');
            }
            salvando = false;
            resolve();
        })
        .catch(error => {
            salvando = false;
            if (!isAutoSave) {
                mostrarNotificacao('❌ Erro ao salvar: ' + error.message, 'error');
            }
            reject(error);
        });
    });
}

function enviarParaGoogleSheets(isAutoSave = false) {
    if (salvando) {
        mostrarNotificacao('Já está salvando. Aguarde...', 'warning');
        return;
    }
    
    if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL === 'SUA_URL_DO_WEB_APP_AQUI') {
        mostrarNotificacao('Configure a URL do Google Sheets no código!', 'error');
        return;
    }
    
    if (!isAutoSave) {
        document.getElementById('btnEnviarTexto').style.display = 'none';
        document.getElementById('btnEnviarLoading').style.display = 'inline-block';
        document.getElementById('btnEnviar').disabled = true;
    }
    
    atualizarStatusSincronizacao('syncing', 'Sincronizando...');
    
    const dadosCompletos = coletarDadosCompletos();
    
    enviarDadosParaGoogle(dadosCompletos, isAutoSave)
        .then(() => {
            atualizarStatusSincronizacao('online', 'Sincronizado');
            
            if (!isAutoSave) {
                document.getElementById('btnEnviarTexto').style.display = 'inline';
                document.getElementById('btnEnviarLoading').style.display = 'none';
                document.getElementById('btnEnviar').disabled = false;
                
                if (editandoId) {
                    editandoId = null;
                    document.getElementById('editModeBadge').classList.remove('active');
                    document.getElementById('btnCancelar').style.display = 'none';
                }
                
                setTimeout(() => {
                    if (confirm('Dados salvos! Ir para o histórico?')) {
                        showTab('historico', document.querySelectorAll('.tab-btn')[4]);
                        setTimeout(carregarHistoricoDoGoogle, 2000);
                    }
                }, 500);
            }
        })
        .catch(error => {
            atualizarStatusSincronizacao('offline', 'Falha');
            adicionarFilaSincronizacao();
            
            if (!isAutoSave) {
                document.getElementById('btnEnviarTexto').style.display = 'inline';
                document.getElementById('btnEnviarLoading').style.display = 'none';
                document.getElementById('btnEnviar').disabled = false;
            }
        });
}

// ===========================================
// FUNÇÕES DE FORMATAÇÃO
// ===========================================
function formatarMoeda(valor) {
    if (valor === undefined || valor === null || isNaN(valor)) return 'R$ 0,00';
    return 'R$ ' + valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

function formatarPercentual(valor) {
    if (valor === undefined || valor === null || isNaN(valor)) return '0,0%';
    return valor.toFixed(1).replace('.', ',') + '%';
}

function formatarNumero(valor) {
    if (valor === undefined || valor === null || isNaN(valor)) return '0,00';
    return valor.toFixed(2).replace('.', ',');
}

// ===========================================
// FUNÇÕES DE CÁLCULO
// ===========================================
function calcularPrecos() {
    try {
        const overheadHora = parseFloat(document.getElementById('overhead_hora')?.value || 20);
        
        // Calcular custo por perfil
        const custosPerfil = {
            'Estágio': (parseFloat(document.getElementById('custo_estagio')?.value || 2500) / parseFloat(document.getElementById('horas_estagio')?.value || 150)) + overheadHora,
            'Jr': (parseFloat(document.getElementById('custo_jr')?.value || 5000) / parseFloat(document.getElementById('horas_jr')?.value || 150)) + overheadHora,
            'Pl': (parseFloat(document.getElementById('custo_pl')?.value || 8000) / parseFloat(document.getElementById('horas_pl')?.value || 150)) + overheadHora,
            'Sr': (parseFloat(document.getElementById('custo_sr')?.value || 12000) / parseFloat(document.getElementById('horas_sr')?.value || 150)) + overheadHora,
            'Coord': (parseFloat(document.getElementById('custo_coord')?.value || 15000) / parseFloat(document.getElementById('horas_coord')?.value || 150)) + overheadHora,
            'Sócio': (parseFloat(document.getElementById('custo_socio')?.value || 20000) / parseFloat(document.getElementById('horas_socio')?.value || 150)) + overheadHora
        };

        let custoDiretoTotal = 0;
        let totalHoras = 0;
        let perfisArray = [];
        
        document.querySelectorAll('.perfil-row').forEach(row => {
            const perfil = row.querySelector('.perfil-nome').value;
            const horas = parseFloat(row.querySelector('.perfil-horas').value) || 0;
            const custoHora = custosPerfil[perfil] || 0;
            totalHoras += horas;
            custoDiretoTotal += custoHora * horas;
            
            perfisArray.push({
                nome: perfil,
                horas: horas,
                custoHora: custoHora,
                custoTotal: custoHora * horas
            });
        });

        // Aplicar buffers
        const complexidade = document.getElementById('complexidade')?.value || 'Média';
        const urgencia = document.getElementById('urgencia')?.value || 'Normal';
        
        let bufferComplexidade = 0.2;
        if (complexidade === 'Baixa') bufferComplexidade = parseFloat(document.getElementById('buffer_complexidade_baixa')?.value || 10) / 100;
        else if (complexidade === 'Média') bufferComplexidade = parseFloat(document.getElementById('buffer_complexidade_media')?.value || 20) / 100;
        else if (complexidade === 'Alta') bufferComplexidade = parseFloat(document.getElementById('buffer_complexidade_alta')?.value || 30) / 100;
        
        let bufferUrgencia = 0;
        if (urgencia === 'Normal') bufferUrgencia = parseFloat(document.getElementById('buffer_urgencia_normal')?.value || 0) / 100;
        else if (urgencia === 'Urgente') bufferUrgencia = parseFloat(document.getElementById('buffer_urgencia_urgente')?.value || 20) / 100;
        
        const bufferTotal = (1 + bufferComplexidade) * (1 + bufferUrgencia) - 1;
        
        const custoDiretoBuffer = custoDiretoTotal * (1 + bufferTotal);
        const custoOverheadTotal = overheadHora * (totalHoras * (1 + bufferTotal));
        const custoTotal = custoDiretoBuffer + custoOverheadTotal;

        // Determinar margens baseado no modelo de cobrança
        const modeloCobranca = document.querySelector('input[name="modelo_cobranca"]:checked')?.value || 'Hora';
        
        let margemPiso = 0.4, margemAlvo = 0.55, margemPremium = 0.65;
        
        switch(modeloCobranca) {
            case 'Hora':
                margemPiso = parseFloat(document.getElementById('margem_piso_hora')?.value || 40) / 100;
                margemAlvo = parseFloat(document.getElementById('margem_alvo_hora')?.value || 55) / 100;
                margemPremium = parseFloat(document.getElementById('margem_premium_hora')?.value || 65) / 100;
                break;
            case 'Preço fechado':
                margemPiso = parseFloat(document.getElementById('margem_piso_fechado')?.value || 35) / 100;
                margemAlvo = parseFloat(document.getElementById('margem_alvo_fechado')?.value || 50) / 100;
                margemPremium = parseFloat(document.getElementById('margem_premium_fechado')?.value || 60) / 100;
                break;
            case 'Retainer':
                margemPiso = parseFloat(document.getElementById('margem_piso_retainer')?.value || 45) / 100;
                margemAlvo = parseFloat(document.getElementById('margem_alvo_retainer')?.value || 60) / 100;
                margemPremium = parseFloat(document.getElementById('margem_premium_retainer')?.value || 70) / 100;
                break;
            case 'Êxito':
                margemPiso = parseFloat(document.getElementById('margem_piso_exito')?.value || 50) / 100;
                margemAlvo = parseFloat(document.getElementById('margem_alvo_exito')?.value || 70) / 100;
                margemPremium = parseFloat(document.getElementById('margem_premium_exito')?.value || 80) / 100;
                break;
        }

        // Calcular preços
        const precoPiso = custoTotal / (1 - margemPiso);
        const precoAlvo = custoTotal / (1 - margemAlvo);
        const precoPremium = custoTotal / (1 - margemPremium);

        // Calcular custo de parcelamento
        const numParcelas = parseInt(document.getElementById('parcelas')?.value || 6);
        const jurosParcelamento = parseFloat(document.getElementById('juros_parcelamento')?.value || 1) / 100;
        
        let custoParcelamento = 0;
        
        if (numParcelas > 1 && jurosParcelamento > 0) {
            const valorParcela = precoAlvo / numParcelas;
            let valorPresente = 0;
            for (let i = 1; i <= numParcelas; i++) {
                valorPresente += valorParcela / Math.pow(1 + jurosParcelamento, i);
            }
            custoParcelamento = precoAlvo - valorPresente;
        }

        // Calcular deduções
        const imposto = parseFloat(document.getElementById('imposto')?.value || 6) / 100;
        const csPercentual = document.getElementById('aplica_cs')?.value === 'sim' ? 
            (parseFloat(document.getElementById('percentual_cs')?.value || 7.5) / 100) : 0;
        const parceiroPercentual = document.getElementById('tem_parceiro')?.value === 'sim' ? 
            (parseFloat(document.getElementById('percentual_parceiro')?.value || 10) / 100) : 0;
        
        const impostosValor = precoAlvo * imposto;
        const csValor = precoAlvo * csPercentual;
        const parceiroValor = precoAlvo * parceiroPercentual;
        
        const totalDeducoes = imposto + csPercentual + parceiroPercentual;
        const receitaLiquida = precoAlvo * (1 - totalDeducoes);
        const margemLiquidaR$ = receitaLiquida - custoTotal;
        const margemLiquida = precoAlvo > 0 ? (margemLiquidaR$ / precoAlvo) * 100 : 0;

        // Salvar resultados
        resultados = {
            custoDireto: custoDiretoTotal,
            custoTotal: custoTotal,
            custoParcelamento: custoParcelamento,
            precoPiso: precoPiso,
            precoAlvo: precoAlvo,
            precoPremium: precoPremium,
            margemPiso: margemPiso * 100,
            margemAlvo: margemAlvo * 100,
            margemPremium: margemPremium * 100,
            margemLiquida: margemLiquida,
            impostos: impostosValor,
            cs: csValor,
            parceiro: parceiroValor,
            receitaLiquida: receitaLiquida,
            margemLiquidaR$: margemLiquidaR$,
            perfis: perfisArray
        };
        
        atualizarCalculo();
        atualizarOutput();
        gerarAlertas();
        
        return resultados;
    } catch (error) {
        console.error('Erro no cálculo:', error);
        mostrarNotificacao('Erro ao calcular preços', 'error');
        return resultados;
    }
}

function atualizarCalculo() {
    document.getElementById('calculo-custo-direto').textContent = formatarMoeda(resultados.custoDireto);
    
    const complexidade = document.getElementById('complexidade')?.value || 'Média';
    const urgencia = document.getElementById('urgencia')?.value || 'Normal';
    
    let bufferComplexidade = 20;
    if (complexidade === 'Baixa') bufferComplexidade = document.getElementById('buffer_complexidade_baixa')?.value || 10;
    else if (complexidade === 'Média') bufferComplexidade = document.getElementById('buffer_complexidade_media')?.value || 20;
    else if (complexidade === 'Alta') bufferComplexidade = document.getElementById('buffer_complexidade_alta')?.value || 30;
    
    let bufferUrgencia = 0;
    if (urgencia === 'Normal') bufferUrgencia = document.getElementById('buffer_urgencia_normal')?.value || 0;
    else if (urgencia === 'Urgente') bufferUrgencia = document.getElementById('buffer_urgencia_urgente')?.value || 20;
    
    document.getElementById('calculo-buffer-complexidade').textContent = bufferComplexidade + '%';
    document.getElementById('calculo-buffer-urgencia').textContent = bufferUrgencia + '%';
    
    const bufferTotal = (1 + bufferComplexidade/100) * (1 + bufferUrgencia/100) - 1;
    const custoDiretoBuffer = resultados.custoDireto * (1 + bufferTotal);
    
    document.getElementById('calculo-custo-buffer').textContent = formatarMoeda(custoDiretoBuffer);
    document.getElementById('calculo-overhead').textContent = formatarMoeda(resultados.custoTotal - custoDiretoBuffer);
    document.getElementById('calculo-custo-total').textContent = formatarMoeda(resultados.custoTotal);
    document.getElementById('calculo-margem-piso').textContent = formatarPercentual(resultados.margemPiso);
    document.getElementById('calculo-preco-piso').textContent = formatarMoeda(resultados.precoPiso);
    document.getElementById('calculo-margem-alvo').textContent = formatarPercentual(resultados.margemAlvo);
    document.getElementById('calculo-preco-alvo').textContent = formatarMoeda(resultados.precoAlvo);
    
    document.getElementById('calculo-impostos').textContent = formatarMoeda(resultados.impostos);
    document.getElementById('calculo-cs').textContent = formatarMoeda(resultados.cs);
    document.getElementById('calculo-parceiro').textContent = formatarMoeda(resultados.parceiro);
    document.getElementById('calculo-receita-liquida').textContent = formatarMoeda(resultados.receitaLiquida);
    document.getElementById('calculo-margem-liquida-r$').textContent = formatarMoeda(resultados.margemLiquidaR$);
    document.getElementById('calculo-margem-liquida').textContent = formatarPercentual(resultados.margemLiquida);
    document.getElementById('calculo-custo-parcelamento').textContent = formatarMoeda(resultados.custoParcelamento);
}

function atualizarOutput() {
    document.getElementById('output-preco-piso').textContent = formatarMoeda(resultados.precoPiso);
    document.getElementById('output-preco-alvo').textContent = formatarMoeda(resultados.precoAlvo);
    document.getElementById('output-preco-premium').textContent = formatarMoeda(resultados.precoPremium);
    document.getElementById('output-custo-total').textContent = formatarMoeda(resultados.custoTotal);
    document.getElementById('output-impostos').textContent = formatarMoeda(resultados.impostos);
    document.getElementById('output-cs').textContent = formatarMoeda(resultados.cs);
    document.getElementById('output-parceiro').textContent = formatarMoeda(resultados.parceiro);
    document.getElementById('output-custo-parcelamento').textContent = formatarMoeda(resultados.custoParcelamento);
    document.getElementById('output-margem-r$').textContent = formatarMoeda(resultados.margemLiquidaR$);
    document.getElementById('output-margem').textContent = formatarPercentual(resultados.margemLiquida);
    
    const entradaPercentual = parseFloat(document.getElementById('entrada')?.value || 30) / 100;
    const numParcelas = parseInt(document.getElementById('parcelas')?.value || 6);
    const jurosMensal = parseFloat(document.getElementById('juros_parcelamento')?.value || 1) / 100;
    
    const valorEntrada = resultados.precoAlvo * entradaPercentual;
    const valorFinanciado = resultados.precoAlvo - valorEntrada;
    
    document.getElementById('output-entrada-percent').textContent = (entradaPercentual * 100).toFixed(0);
    
    let valorParcela = numParcelas > 0 ? valorFinanciado / numParcelas : 0;
    let valorTotalJuros = resultados.precoAlvo;
    
    if (numParcelas > 1 && jurosMensal > 0 && valorFinanciado > 0) {
        const fator = (jurosMensal * Math.pow(1 + jurosMensal, numParcelas)) / (Math.pow(1 + jurosMensal, numParcelas) - 1);
        valorParcela = valorFinanciado * fator;
        valorTotalJuros = valorEntrada + (valorParcela * numParcelas);
    }
    
    document.getElementById('output-entrada').textContent = formatarMoeda(valorEntrada);
    document.getElementById('output-parcelas').textContent = numParcelas + 'x de ' + formatarMoeda(valorParcela);
    document.getElementById('output-total-juros').textContent = formatarMoeda(valorTotalJuros);
    document.getElementById('output-total').textContent = formatarMoeda(resultados.precoAlvo);
}

// ===========================================
// FUNÇÃO DE ALERTAS - REGRAS DE NEGÓCIO
// ===========================================
function gerarAlertas() {
    const alertasContainer = document.getElementById('alertas-container');
    alertasContainer.innerHTML = '';
    
    const modeloCobranca = document.querySelector('input[name="modelo_cobranca"]:checked')?.value;
    const desconto = parseFloat(document.getElementById('desconto')?.value || 0) / 100;
    const precoComDesconto = resultados.precoAlvo * (1 - desconto);
    const entrada = parseFloat(document.getElementById('entrada')?.value || 0);
    const escopo = document.getElementById('escopo')?.value || '';
    const risco = document.getElementById('risco_inadimplencia')?.value;
    const numParcelas = parseInt(document.getElementById('parcelas')?.value || 6);
    
    let alertas = [];
    
    // ALERTA 1: Abaixo do piso
    if (precoComDesconto < resultados.precoPiso && resultados.precoPiso > 0) {
        alertas.push({
            tipo: 'danger',
            mensagem: '⚠️ Abaixo do piso - O preço com desconto está abaixo do mínimo recomendado!'
        });
    }
    
    // ALERTA 2: Desconto acima da alçada
    if (desconto > 0.15) {
        alertas.push({
            tipo: 'warning',
            mensagem: '⚠️ Desconto acima da alçada - Desconto superior a 15% precisa de aprovação!'
        });
    }
    
    // ALERTA 3: Modelo de êxito sem cobertura de custo
    if (modeloCobranca === 'Êxito') {
        if (entrada < 30) {
            alertas.push({
                tipo: 'danger',
                mensagem: '⚠️ Êxito sem cobertura - Exija entrada mínima de 30% para cobrir custos!'
            });
        }
        if (resultados.precoAlvo < resultados.custoTotal * 1.2) {
            alertas.push({
                tipo: 'warning',
                mensagem: '⚠️ Êxito com margem muito baixa - O risco não compensa!'
            });
        }
    }
    
    // ALERTA 4: Escopo sem limites (retainer)
    if (modeloCobranca === 'Retainer' && (escopo.trim() === '' || escopo.length < 20)) {
        alertas.push({
            tipo: 'warning',
            mensagem: '⚠️ Retainer sem limites - Defina claramente os limites de horas/inclusões no contrato!'
        });
    }
    
    // ALERTA 5: Risco de inadimplência
    if (risco === 'Alto') {
        alertas.push({
            tipo: 'warning',
            mensagem: '⚠️ Cliente com alto risco de inadimplência - Considere exigir entrada maior (mínimo 50%) ou pagamento antecipado!'
        });
    }
    
    // ALERTA 6: Margem líquida baixa
    if (resultados.margemLiquida < 20 && resultados.margemLiquida > 0) {
        alertas.push({
            tipo: 'warning',
            mensagem: '⚠️ Margem líquida baixa (menor que 20%) - Reavalie os custos ou aumente o preço!'
        });
    }
    
    // ALERTA 7: Parcelamento longo
    if (numParcelas > 12) {
        if (risco === 'Alto') {
            alertas.push({
                tipo: 'danger',
                mensagem: '⚠️ Parcelamento longo para cliente de alto risco - Muito perigoso!'
            });
        } else {
            alertas.push({
                tipo: 'info',
                mensagem: 'ℹ️ Parcelamento longo - Considere o custo do dinheiro no tempo.'
            });
        }
    }
    
    // ALERTA 8: Modelo híbrido sem definição
    if (modeloCobranca === 'Híbrido' && escopo.trim() === '') {
        alertas.push({
            tipo: 'info',
            mensagem: 'ℹ️ Modelo híbrido - Defina a parte fixa (retainer/fechado) e a variável (êxito) separadamente.'
        });
    }
    
    // Renderizar alertas
    if (alertas.length === 0) {
        alertasContainer.innerHTML = '<div class="alert alert-success">✅ Todos os parâmetros estão dentro do esperado.</div>';
    } else {
        alertas.forEach(alerta => {
            alertasContainer.innerHTML += `<div class="alert alert-${alerta.tipo}">${alerta.mensagem}</div>`;
        });
    }
}

// ===========================================
// FUNÇÕES DOS PERFIS
// ===========================================
function adicionarPerfil() {
    const container = document.getElementById('perfis-container');
    const newRow = document.createElement('div');
    newRow.className = 'perfil-row';
    
    const complexidade = document.getElementById('complexidade').value;
    let buffer = '20%';
    if (complexidade === 'Baixa') buffer = document.getElementById('buffer_complexidade_baixa')?.value + '%' || '10%';
    else if (complexidade === 'Média') buffer = document.getElementById('buffer_complexidade_media')?.value + '%' || '20%';
    else if (complexidade === 'Alta') buffer = document.getElementById('buffer_complexidade_alta')?.value + '%' || '30%';
    
    newRow.innerHTML = `
        <select class="perfil-nome">
            <option value="Estágio">Estágio</option>
            <option value="Jr">Jr</option>
            <option value="Pl" selected>Pl</option>
            <option value="Sr">Sr</option>
            <option value="Coord">Coord</option>
            <option value="Sócio">Sócio</option>
        </select>
        <input type="number" class="perfil-horas" placeholder="Horas" value="40" min="0" step="1">
        <input type="text" class="perfil-buffer" placeholder="Buffer %" readonly value="${buffer}">
        <button type="button" class="btn-danger" onclick="removerPerfil(this)" style="padding: 12px;">🗑️</button>
    `;
    container.appendChild(newRow);
    
    newRow.querySelectorAll('select, input').forEach(el => {
        el.addEventListener('change', agendarSincronizacaoAutomatica);
        el.addEventListener('input', agendarSincronizacaoAutomatica);
    });
}

function removerPerfil(botao) {
    if (document.querySelectorAll('.perfil-row').length > 1) {
        botao.parentElement.remove();
        agendarSincronizacaoAutomatica();
    } else {
        mostrarNotificacao('É necessário ter pelo menos um perfil!', 'error');
    }
}

function atualizarBufferPerfis() {
    const complexidade = document.getElementById('complexidade').value;
    let buffer = '20%';
    
    if (complexidade === 'Baixa') buffer = document.getElementById('buffer_complexidade_baixa')?.value + '%' || '10%';
    else if (complexidade === 'Média') buffer = document.getElementById('buffer_complexidade_media')?.value + '%' || '20%';
    else if (complexidade === 'Alta') buffer = document.getElementById('buffer_complexidade_alta')?.value + '%' || '30%';
    
    document.querySelectorAll('.perfil-buffer').forEach(input => {
        input.value = buffer;
    });
}

function toggleParceiro() {
    const temParceiro = document.getElementById('tem_parceiro').value;
    document.getElementById('parceiro-group').style.display = temParceiro === 'sim' ? 'block' : 'none';
    calcularPrecos();
}

function toggleCS() {
    const aplicaCS = document.getElementById('aplica_cs').value;
    document.getElementById('cs-group').style.display = aplicaCS === 'sim' ? 'block' : 'none';
    calcularPrecos();
}

// ===========================================
// FUNÇÕES DO HISTÓRICO
// ===========================================
function carregarHistoricoDoGoogle() {
    if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL === 'SUA_URL_DO_WEB_APP_AQUI') {
        document.getElementById('historico-lista').innerHTML = '<tr><td colspan="13" style="text-align: center;">Configure a URL do Web App no código primeiro!</td></tr>';
        return;
    }
    
    document.getElementById('historico-lista').innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;"><div class="loading" style="border-top-color: #667eea;"></div> Carregando dados...</td></tr>';
    
    fetch(GOOGLE_SHEETS_URL + '?action=carregarHistorico')
        .then(response => response.json())
        .then(data => {
            historicoCompleto = data || [];
            renderizarHistorico(historicoCompleto);
            
            document.getElementById('ultima-sincronizacao').textContent = new Date().toLocaleTimeString('pt-BR');
            
            if (historicoCompleto.length > 0) {
                mostrarNotificacao(`${historicoCompleto.length} registros carregados!`, 'success');
            }
        })
        .catch(error => {
            document.getElementById('historico-lista').innerHTML = '<tr><td colspan="13" style="text-align: center; color: #f56565;">Erro ao carregar: ' + error.message + '</td></tr>';
            mostrarNotificacao('Erro ao carregar histórico: ' + error.message, 'error');
        });
}

function renderizarHistorico(dados) {
    const tbody = document.getElementById('historico-lista');
    tbody.innerHTML = '';
    
    document.getElementById('total-registros').textContent = dados.length;
    
    if (!dados || dados.length === 0) {
        tbody.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;">Nenhum registro encontrado</td></tr>';
        return;
    }
    
    dados.forEach(item => {
        const row = tbody.insertRow();
        
        let dataFormatada = '---';
        if (item.data) {
            try {
                const dataObj = new Date(item.data);
                dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' ' + 
                               dataObj.toLocaleTimeString('pt-BR', {hour: '2-digit', minute: '2-digit', second: '2-digit'});
            } catch (e) {
                dataFormatada = item.data;
            }
        }
        
        let statusClass = 'status-pendente';
        if (item.status === 'Ganho') statusClass = 'status-ganho';
        if (item.status === 'Perdido') statusClass = 'status-perdido';
        
        row.innerHTML = `
            <td title="${item.id || ''}">${item.id ? item.id.substring(0, 8) + '...' : '---'}</td>
            <td>${dataFormatada}</td>
            <td>${item.cliente || '---'}</td>
            <td>${item.segmento || '---'}</td>
            <td>${item.tipo || '---'}</td>
            <td>${item.risco || '---'}</td>
            <td>${item.produto || '---'}</td>
            <td>${item.modelo || '---'}</td>
            <td class="money">${formatarMoeda(item.precoAlvo)}</td>
            <td class="money">${formatarMoeda(item.custoTotal)}</td>
            <td class="percent">${(item.margem || 0).toFixed(1).replace('.', ',')}%</td>
            <td>
                <span class="status-badge ${statusClass}">${item.status || 'Pendente'}</span>
            </td>
            <td>
                <div class="action-buttons">
                    <button class="btn-primary" onclick="editarSimulacao('${item.id}')" style="padding: 4px 8px;" title="Editar">✏️</button>
                    <button class="btn-danger" onclick="excluirSimulacao('${item.id}')" style="padding: 4px 8px;" title="Excluir">🗑️</button>
                </div>
            </td>
        `;
    });
}

function limparHistoricoLocal() {
    if (confirm('Limpar visualização do histórico? Os dados no Google Sheets não serão afetados.')) {
        document.getElementById('historico-lista').innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;">Visualização limpa. Clique em "Sincronizar" para recarregar.</td></tr>';
        document.getElementById('total-registros').textContent = '0';
        mostrarNotificacao('Visualização limpa', 'info');
    }
}

function exportarCSV() {
    if (historicoCompleto.length === 0) {
        mostrarNotificacao('Nenhum dado para exportar', 'warning');
        return;
    }
    
    let csv = 'ID,Data/Hora,Cliente,Segmento,Tipo,Risco,Produto,Modelo,Preço Alvo,Custo Total,Margem,Status\n';
    
    historicoCompleto.forEach(item => {
        csv += `"${item.id || ''}","${item.data || ''}","${item.cliente || ''}","${item.segmento || ''}","${item.tipo || ''}","${item.risco || ''}","${item.produto || ''}","${item.modelo || ''}",${item.precoAlvo || 0},${item.custoTotal || 0},${item.margem || 0},"${item.status || 'Pendente'}"\n`;
    });
    
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'historico_precificacao.csv');
    link.style.display = 'none';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    mostrarNotificacao('CSV exportado com sucesso!', 'success');
}

// ===========================================
// FUNÇÕES DE EDIÇÃO
// ===========================================
function editarSimulacao(id) {
    if (!confirm('Carregar esta simulação para edição?')) return;
    
    fetch(GOOGLE_SHEETS_URL + `?action=carregarSimulacao&id=${id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                const sim = data.dados;
                
                editandoId = id;
                document.getElementById('editModeBadge').classList.add('active');
                document.getElementById('btnCancelar').style.display = 'inline-flex';
                
                document.getElementById('cliente_nome').value = sim.input.cliente || '';
                document.getElementById('segmento').value = sim.input.segmento || '';
                document.getElementById('tipo_cliente').value = sim.input.tipo || 'Novo';
                document.getElementById('risco_inadimplencia').value = sim.input.risco || 'Médio';
                
                document.getElementById('produto').value = sim.input.produto || 'Consultoria Estratégica';
                document.getElementById('escopo').value = sim.input.escopo || '';
                document.getElementById('complexidade').value = sim.input.complexidade || 'Média';
                document.getElementById('urgencia').value = sim.input.urgencia || 'Normal';
                
                document.querySelectorAll('input[name="modelo_cobranca"]').forEach(radio => {
                    radio.checked = (radio.value === sim.input.modeloCobranca);
                });
                
                document.getElementById('entrada').value = sim.input.entrada || 30;
                document.getElementById('parcelas').value = sim.input.parcelas || 6;
                document.getElementById('desconto').value = sim.input.desconto || 0;
                document.getElementById('tem_parceiro').value = sim.input.temParceiro || 'nao';
                
                if (sim.input.temParceiro === 'sim') {
                    document.getElementById('parceiro-group').style.display = 'block';
                    document.getElementById('percentual_parceiro').value = sim.input.percentualParceiro || 10;
                } else {
                    document.getElementById('parceiro-group').style.display = 'none';
                }
                
                document.getElementById('aplica_cs').value = sim.input.aplicaCS || 'sim';
                
                if (sim.input.aplicaCS === 'sim') {
                    document.getElementById('cs-group').style.display = 'block';
                    document.getElementById('percentual_cs').value = sim.input.percentualCS || 7.5;
                } else {
                    document.getElementById('cs-group').style.display = 'none';
                }
                
                const container = document.getElementById('perfis-container');
                container.innerHTML = '';
                
                if (sim.perfis && sim.perfis.length > 0) {
                    sim.perfis.forEach(perfil => {
                        const newRow = document.createElement('div');
                        newRow.className = 'perfil-row';
                        newRow.innerHTML = `
                            <select class="perfil-nome">
                                <option value="Estágio" ${perfil.nome === 'Estágio' ? 'selected' : ''}>Estágio</option>
                                <option value="Jr" ${perfil.nome === 'Jr' ? 'selected' : ''}>Jr</option>
                                <option value="Pl" ${perfil.nome === 'Pl' ? 'selected' : ''}>Pl</option>
                                <option value="Sr" ${perfil.nome === 'Sr' ? 'selected' : ''}>Sr</option>
                                <option value="Coord" ${perfil.nome === 'Coord' ? 'selected' : ''}>Coord</option>
                                <option value="Sócio" ${perfil.nome === 'Sócio' ? 'selected' : ''}>Sócio</option>
                            </select>
                            <input type="number" class="perfil-horas" placeholder="Horas" value="${perfil.horas}" min="0" step="1">
                            <input type="text" class="perfil-buffer" placeholder="Buffer %" readonly value="20%">
                            <button type="button" class="btn-danger" onclick="removerPerfil(this)" style="padding: 12px;">🗑️</button>
                        `;
                        container.appendChild(newRow);
                    });
                }
                
                atualizarBufferPerfis();
                calcularPrecos();
                
                mostrarNotificacao('Simulação carregada para edição!', 'success');
                showTab('input', document.querySelectorAll('.tab-btn')[0]);
                
            } else {
                mostrarNotificacao('Erro ao carregar: ' + (data.error || 'Erro desconhecido'), 'error');
            }
        })
        .catch(error => {
            mostrarNotificacao('Erro ao carregar: ' + error.message, 'error');
        });
}

function excluirSimulacao(id) {
    if (!confirm('Excluir esta simulação permanentemente?')) return;
    
    fetch(GOOGLE_SHEETS_URL + `?action=excluirSimulacao&id=${id}`)
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                mostrarNotificacao('Simulação excluída!', 'success');
                carregarHistoricoDoGoogle();
            } else {
                mostrarNotificacao('Erro ao excluir: ' + (data.error || 'Erro desconhecido'), 'error');
            }
        })
        .catch(error => {
            mostrarNotificacao('Erro ao excluir: ' + error.message, 'error');
        });
}

function cancelarEdicao() {
    if (editandoId) {
        if (confirm('Cancelar edição? As alterações não salvas serão perdidas.')) {
            editandoId = null;
            document.getElementById('editModeBadge').classList.remove('active');
            document.getElementById('btnCancelar').style.display = 'none';
            location.reload();
        }
    }
}