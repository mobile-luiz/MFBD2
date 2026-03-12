// ===========================================
// CONFIGURAÇÕES
// ===========================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwhO0bGHNWGCnzbzU1mDwVkFWfsCn-9jNsoRc5pWS5mFY0z93AQbEWGbja90hEESuOtpw/exec';

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
// NAMESPACES PARA ORGANIZAÇÃO
// ===========================================
const UI = {
    showTab: function(tabName, element) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        document.getElementById(`tab-${tabName}`).classList.add('active');
        element.classList.add('active');
        
        if (tabName === 'historico') Historico.carregar();
    }
};

const Perfis = {
    adicionar: function() {
        const container = document.getElementById('perfis-container');
        const newRow = document.createElement('div');
        newRow.className = 'perfil-row';
        
        const complexidade = document.getElementById('complexidade')?.value || 'Média';
        let buffer = '20%';
        
        if (complexidade === 'Baixa') buffer = (document.getElementById('buffer_complexidade_baixa')?.value || '10') + '%';
        else if (complexidade === 'Média') buffer = (document.getElementById('buffer_complexidade_media')?.value || '20') + '%';
        else if (complexidade === 'Alta') buffer = (document.getElementById('buffer_complexidade_alta')?.value || '30') + '%';
        
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
            <button type="button" class="btn-danger" onclick="Perfis.remover(this)" style="padding: 12px;">🗑️</button>
        `;
        container.appendChild(newRow);
        
        newRow.querySelectorAll('select, input').forEach(el => {
            el.addEventListener('change', Sincronizacao.agendarAutomatica);
            el.addEventListener('input', Sincronizacao.agendarAutomatica);
        });
        
        Calculadora.calcular();
    },
    
    remover: function(botao) {
        if (document.querySelectorAll('.perfil-row').length > 1) {
            botao.closest('.perfil-row').remove();
            Sincronizacao.agendarAutomatica();
        } else {
            Utils.mostrarNotificacao('É necessário ter pelo menos um perfil!', 'error');
        }
    },
    
    atualizarBuffer: function() {
        const complexidade = document.getElementById('complexidade')?.value || 'Média';
        let buffer = '20%';
        
        if (complexidade === 'Baixa') buffer = (document.getElementById('buffer_complexidade_baixa')?.value || '10') + '%';
        else if (complexidade === 'Média') buffer = (document.getElementById('buffer_complexidade_media')?.value || '20') + '%';
        else if (complexidade === 'Alta') buffer = (document.getElementById('buffer_complexidade_alta')?.value || '30') + '%';
        
        document.querySelectorAll('.perfil-buffer').forEach(input => {
            input.value = buffer;
        });
    }
};

const Tabelas = {
    atualizar: function() {
        this.atualizarCustosBase();
        Utils.mostrarNotificacao('Parâmetros atualizados!', 'success');
        Calculadora.calcular();
        Sincronizacao.agendarAutomatica();
    },
    
    atualizarCustosBase: function() {
        const overheadHora = Utils.parseFloatSafe(document.getElementById('overhead_hora')?.value, 20);
        
        const perfis = ['estagio', 'jr', 'pl', 'sr', 'coord', 'socio'];
        perfis.forEach(perfil => {
            const custo = Utils.parseFloatSafe(document.getElementById(`custo_${perfil}`)?.value, 
                perfil === 'estagio' ? 2500 : perfil === 'jr' ? 5000 : perfil === 'pl' ? 8000 : 
                perfil === 'sr' ? 12000 : perfil === 'coord' ? 15000 : 20000);
            const horas = Utils.parseFloatSafe(document.getElementById(`horas_${perfil}`)?.value, 150);
            const custoBase = custo / horas;
            
            const elBase = document.getElementById(`custo_base_${perfil}`);
            if (elBase) elBase.textContent = Utils.formatarMoeda(custoBase);
            
            const custoCompleto = custoBase + overheadHora;
            const elCompleto = document.getElementById(`custo_completo_${perfil}`);
            if (elCompleto) elCompleto.textContent = Utils.formatarMoeda(custoCompleto);
        });
    }
};

const Calculadora = {
    calcular: function() {
        try {
            const overheadHora = Utils.parseFloatSafe(document.getElementById('overhead_hora')?.value, 20);
            
            // Calcular custo por perfil
            const custosPerfil = {
                'Estágio': (Utils.parseFloatSafe(document.getElementById('custo_estagio')?.value, 2500) / 
                           Utils.parseFloatSafe(document.getElementById('horas_estagio')?.value, 150)) + overheadHora,
                'Jr': (Utils.parseFloatSafe(document.getElementById('custo_jr')?.value, 5000) / 
                      Utils.parseFloatSafe(document.getElementById('horas_jr')?.value, 150)) + overheadHora,
                'Pl': (Utils.parseFloatSafe(document.getElementById('custo_pl')?.value, 8000) / 
                      Utils.parseFloatSafe(document.getElementById('horas_pl')?.value, 150)) + overheadHora,
                'Sr': (Utils.parseFloatSafe(document.getElementById('custo_sr')?.value, 12000) / 
                      Utils.parseFloatSafe(document.getElementById('horas_sr')?.value, 150)) + overheadHora,
                'Coord': (Utils.parseFloatSafe(document.getElementById('custo_coord')?.value, 15000) / 
                         Utils.parseFloatSafe(document.getElementById('horas_coord')?.value, 150)) + overheadHora,
                'Sócio': (Utils.parseFloatSafe(document.getElementById('custo_socio')?.value, 20000) / 
                         Utils.parseFloatSafe(document.getElementById('horas_socio')?.value, 150)) + overheadHora
            };

            let custoDiretoTotal = 0;
            let totalHoras = 0;
            let perfisArray = [];
            
            document.querySelectorAll('.perfil-row').forEach(row => {
                const perfil = row.querySelector('.perfil-nome')?.value || 'Pl';
                const horas = Utils.parseFloatSafe(row.querySelector('.perfil-horas')?.value, 0);
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
            if (complexidade === 'Baixa') bufferComplexidade = Utils.parseFloatSafe(document.getElementById('buffer_complexidade_baixa')?.value, 10) / 100;
            else if (complexidade === 'Média') bufferComplexidade = Utils.parseFloatSafe(document.getElementById('buffer_complexidade_media')?.value, 20) / 100;
            else if (complexidade === 'Alta') bufferComplexidade = Utils.parseFloatSafe(document.getElementById('buffer_complexidade_alta')?.value, 30) / 100;
            
            let bufferUrgencia = 0;
            if (urgencia === 'Normal') bufferUrgencia = Utils.parseFloatSafe(document.getElementById('buffer_urgencia_normal')?.value, 0) / 100;
            else if (urgencia === 'Urgente') bufferUrgencia = Utils.parseFloatSafe(document.getElementById('buffer_urgencia_urgente')?.value, 20) / 100;
            
            const bufferTotal = (1 + bufferComplexidade) * (1 + bufferUrgencia) - 1;
            
            const custoDiretoBuffer = custoDiretoTotal * (1 + bufferTotal);
            const custoOverheadTotal = overheadHora * (totalHoras * (1 + bufferTotal));
            const custoTotal = custoDiretoBuffer + custoOverheadTotal;

            // Determinar margens baseado no modelo de cobrança
            const modeloCobranca = document.querySelector('input[name="modelo_cobranca"]:checked')?.value || 'Hora';
            
            let margemPiso = 0.4, margemAlvo = 0.55, margemPremium = 0.65;
            
            switch(modeloCobranca) {
                case 'Hora':
                    margemPiso = Utils.parseFloatSafe(document.getElementById('margem_piso_hora')?.value, 40) / 100;
                    margemAlvo = Utils.parseFloatSafe(document.getElementById('margem_alvo_hora')?.value, 55) / 100;
                    margemPremium = Utils.parseFloatSafe(document.getElementById('margem_premium_hora')?.value, 65) / 100;
                    break;
                case 'Preço fechado':
                    margemPiso = Utils.parseFloatSafe(document.getElementById('margem_piso_fechado')?.value, 35) / 100;
                    margemAlvo = Utils.parseFloatSafe(document.getElementById('margem_alvo_fechado')?.value, 50) / 100;
                    margemPremium = Utils.parseFloatSafe(document.getElementById('margem_premium_fechado')?.value, 60) / 100;
                    break;
                case 'Retainer':
                    margemPiso = Utils.parseFloatSafe(document.getElementById('margem_piso_retainer')?.value, 45) / 100;
                    margemAlvo = Utils.parseFloatSafe(document.getElementById('margem_alvo_retainer')?.value, 60) / 100;
                    margemPremium = Utils.parseFloatSafe(document.getElementById('margem_premium_retainer')?.value, 70) / 100;
                    break;
                case 'Êxito':
                    margemPiso = Utils.parseFloatSafe(document.getElementById('margem_piso_exito')?.value, 50) / 100;
                    margemAlvo = Utils.parseFloatSafe(document.getElementById('margem_alvo_exito')?.value, 70) / 100;
                    margemPremium = Utils.parseFloatSafe(document.getElementById('margem_premium_exito')?.value, 80) / 100;
                    break;
            }

            // Calcular preços
            const precoPiso = custoTotal / (1 - margemPiso);
            const precoAlvo = custoTotal / (1 - margemAlvo);
            const precoPremium = custoTotal / (1 - margemPremium);

            // Calcular custo de parcelamento
            const numParcelas = parseInt(document.getElementById('parcelas')?.value) || 6;
            const jurosParcelamento = Utils.parseFloatSafe(document.getElementById('juros_parcelamento')?.value, 1) / 100;
            
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
            const imposto = Utils.parseFloatSafe(document.getElementById('imposto')?.value, 6) / 100;
            const csPercentual = document.getElementById('aplica_cs')?.value === 'sim' ? 
                Utils.parseFloatSafe(document.getElementById('percentual_cs')?.value, 7.5) / 100 : 0;
            const parceiroPercentual = document.getElementById('tem_parceiro')?.value === 'sim' ? 
                Utils.parseFloatSafe(document.getElementById('percentual_parceiro')?.value, 10) / 100 : 0;
            
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
            
            this.atualizarCalculo();
            this.atualizarOutput();
            Alertas.gerar();
            
            return resultados;
        } catch (error) {
            console.error('Erro no cálculo:', error);
            Utils.mostrarNotificacao('Erro ao calcular preços', 'error');
            return resultados;
        }
    },
    
    atualizarCalculo: function() {
        Utils.setTextContent('calculo-custo-direto', Utils.formatarMoeda(resultados.custoDireto));
        
        const complexidade = document.getElementById('complexidade')?.value || 'Média';
        const urgencia = document.getElementById('urgencia')?.value || 'Normal';
        
        let bufferComplexidade = 20;
        if (complexidade === 'Baixa') bufferComplexidade = document.getElementById('buffer_complexidade_baixa')?.value || 10;
        else if (complexidade === 'Média') bufferComplexidade = document.getElementById('buffer_complexidade_media')?.value || 20;
        else if (complexidade === 'Alta') bufferComplexidade = document.getElementById('buffer_complexidade_alta')?.value || 30;
        
        let bufferUrgencia = 0;
        if (urgencia === 'Normal') bufferUrgencia = document.getElementById('buffer_urgencia_normal')?.value || 0;
        else if (urgencia === 'Urgente') bufferUrgencia = document.getElementById('buffer_urgencia_urgente')?.value || 20;
        
        Utils.setTextContent('calculo-buffer-complexidade', bufferComplexidade + '%');
        Utils.setTextContent('calculo-buffer-urgencia', bufferUrgencia + '%');
        
        const bufferTotal = (1 + bufferComplexidade/100) * (1 + bufferUrgencia/100) - 1;
        const custoDiretoBuffer = resultados.custoDireto * (1 + bufferTotal);
        
        Utils.setTextContent('calculo-custo-buffer', Utils.formatarMoeda(custoDiretoBuffer));
        Utils.setTextContent('calculo-overhead', Utils.formatarMoeda(resultados.custoTotal - custoDiretoBuffer));
        Utils.setTextContent('calculo-custo-total', Utils.formatarMoeda(resultados.custoTotal));
        Utils.setTextContent('calculo-margem-piso', Utils.formatarPercentual(resultados.margemPiso));
        Utils.setTextContent('calculo-preco-piso', Utils.formatarMoeda(resultados.precoPiso));
        Utils.setTextContent('calculo-margem-alvo', Utils.formatarPercentual(resultados.margemAlvo));
        Utils.setTextContent('calculo-preco-alvo', Utils.formatarMoeda(resultados.precoAlvo));
        Utils.setTextContent('calculo-margem-premium', Utils.formatarPercentual(resultados.margemPremium));
        Utils.setTextContent('calculo-preco-premium', Utils.formatarMoeda(resultados.precoPremium));
        
        Utils.setTextContent('calculo-impostos', Utils.formatarMoeda(resultados.impostos));
        Utils.setTextContent('calculo-cs', Utils.formatarMoeda(resultados.cs));
        Utils.setTextContent('calculo-parceiro', Utils.formatarMoeda(resultados.parceiro));
        Utils.setTextContent('calculo-receita-liquida', Utils.formatarMoeda(resultados.receitaLiquida));
        Utils.setTextContent('calculo-margem-liquida-r$', Utils.formatarMoeda(resultados.margemLiquidaR$));
        Utils.setTextContent('calculo-margem-liquida', Utils.formatarPercentual(resultados.margemLiquida));
        Utils.setTextContent('calculo-custo-parcelamento', Utils.formatarMoeda(resultados.custoParcelamento));
    },
    
    atualizarOutput: function() {
        Utils.setTextContent('output-preco-piso', Utils.formatarMoeda(resultados.precoPiso));
        Utils.setTextContent('output-preco-alvo', Utils.formatarMoeda(resultados.precoAlvo));
        Utils.setTextContent('output-preco-premium', Utils.formatarMoeda(resultados.precoPremium));
        Utils.setTextContent('output-custo-total', Utils.formatarMoeda(resultados.custoTotal));
        Utils.setTextContent('output-impostos', Utils.formatarMoeda(resultados.impostos));
        Utils.setTextContent('output-cs', Utils.formatarMoeda(resultados.cs));
        Utils.setTextContent('output-parceiro', Utils.formatarMoeda(resultados.parceiro));
        Utils.setTextContent('output-custo-parcelamento', Utils.formatarMoeda(resultados.custoParcelamento));
        Utils.setTextContent('output-margem-r$', Utils.formatarMoeda(resultados.margemLiquidaR$));
        Utils.setTextContent('output-margem', Utils.formatarPercentual(resultados.margemLiquida));
        
        const entradaPercentual = Utils.parseFloatSafe(document.getElementById('entrada')?.value, 30) / 100;
        const numParcelas = parseInt(document.getElementById('parcelas')?.value) || 6;
        const jurosMensal = Utils.parseFloatSafe(document.getElementById('juros_parcelamento')?.value, 1) / 100;
        
        const valorEntrada = resultados.precoAlvo * entradaPercentual;
        const valorFinanciado = resultados.precoAlvo - valorEntrada;
        
        Utils.setTextContent('output-entrada-percent', (entradaPercentual * 100).toFixed(0));
        
        let valorParcela = numParcelas > 0 ? valorFinanciado / numParcelas : 0;
        let valorTotalJuros = resultados.precoAlvo;
        
        if (numParcelas > 1 && jurosMensal > 0 && valorFinanciado > 0) {
            const fator = (jurosMensal * Math.pow(1 + jurosMensal, numParcelas)) / (Math.pow(1 + jurosMensal, numParcelas) - 1);
            valorParcela = valorFinanciado * fator;
            valorTotalJuros = valorEntrada + (valorParcela * numParcelas);
        }
        
        Utils.setTextContent('output-entrada', Utils.formatarMoeda(valorEntrada));
        Utils.setTextContent('output-parcelas', numParcelas + 'x de ' + Utils.formatarMoeda(valorParcela));
        Utils.setTextContent('output-total-juros', Utils.formatarMoeda(valorTotalJuros));
        Utils.setTextContent('output-total', Utils.formatarMoeda(resultados.precoAlvo));
    }
};

const Alertas = {
    gerar: function() {
        const alertasContainer = document.getElementById('alertas-container');
        if (!alertasContainer) return;
        
        alertasContainer.innerHTML = '';
        
        const modeloCobranca = document.querySelector('input[name="modelo_cobranca"]:checked')?.value;
        const desconto = Utils.parseFloatSafe(document.getElementById('desconto')?.value, 0) / 100;
        const precoComDesconto = resultados.precoAlvo * (1 - desconto);
        const entrada = Utils.parseFloatSafe(document.getElementById('entrada')?.value, 30);
        const escopo = document.getElementById('escopo')?.value || '';
        const risco = document.getElementById('risco_inadimplencia')?.value;
        const numParcelas = parseInt(document.getElementById('parcelas')?.value) || 6;
        const complexidade = document.getElementById('complexidade')?.value;
        const urgencia = document.getElementById('urgencia')?.value;
        const aplicaCS = document.getElementById('aplica_cs')?.value;
        
        let alertas = [];
        
        // Alerta 1: Abaixo do piso
        if (precoComDesconto < resultados.precoPiso && resultados.precoPiso > 0) {
            alertas.push({
                tipo: 'danger',
                icone: '⚠️',
                titulo: 'Preço Abaixo do Piso',
                mensagem: 'O preço com desconto está abaixo do mínimo recomendado!',
                recomendacao: 'Ajuste o desconto para no máximo ' + 
                    (((resultados.precoPiso / resultados.precoAlvo) * 100).toFixed(1)) + '% para manter-se acima do piso.'
            });
        }
        
        // Alerta 2: Desconto acima da alçada
        if (desconto > 0.15) {
            alertas.push({
                tipo: 'warning',
                icone: '⚠️',
                titulo: 'Desconto Acima da Alçada',
                mensagem: 'Desconto superior a 15% precisa de aprovação da diretoria!',
                recomendacao: 'Solicite aprovação formal antes de prosseguir com a negociação.'
            });
        }
        
        // Alerta 3: Modelo de êxito sem cobertura de custo
        if (modeloCobranca === 'Êxito') {
            if (entrada < 30) {
                alertas.push({
                    tipo: 'danger',
                    icone: '⚠️',
                    titulo: 'Êxito sem Cobertura de Custo',
                    mensagem: 'Modelo de êxito sem cobertura mínima de custos!',
                    recomendacao: 'Exija entrada mínima de 30% para cobrir os custos iniciais do projeto.'
                });
            }
            if (resultados.precoAlvo < resultados.custoTotal * 1.2) {
                alertas.push({
                    tipo: 'warning',
                    icone: '⚠️',
                    titulo: 'Margem Insuficiente no Êxito',
                    mensagem: 'A margem no modelo de êxito é muito baixa para compensar o risco.',
                    recomendacao: 'Aumente o preço alvo para garantir pelo menos 20% de margem sobre os custos.'
                });
            }
        }
        
        // Alerta 4: Escopo sem limites (retainer)
        if (modeloCobranca === 'Retainer') {
            if (escopo.trim() === '' || escopo.length < 30) {
                alertas.push({
                    tipo: 'warning',
                    icone: '⚠️',
                    titulo: 'Escopo sem Limites Definidos',
                    mensagem: 'Contrato retainer sem limites claros de escopo!',
                    recomendacao: 'Defina claramente o limite de horas/mês e o que está incluso no retainer.'
                });
            }
            
            const escopoLower = escopo.toLowerCase();
            if (!escopoLower.includes('limite') && !escopoLower.includes('hora') && !escopoLower.includes('incluso')) {
                alertas.push({
                    tipo: 'info',
                    icone: 'ℹ️',
                    titulo: 'Retainer sem Limites Especificados',
                    mensagem: 'O escopo não menciona limites claros para o retainer.',
                    recomendacao: 'Adicione informações sobre limite de horas, serviços inclusos e excedentes.'
                });
            }
        }
        
        // Alerta 5: Risco de inadimplência
        if (risco === 'Alto') {
            alertas.push({
                tipo: 'warning',
                icone: '⚠️',
                titulo: 'Cliente de Alto Risco',
                mensagem: 'Cliente classificado como alto risco de inadimplência!',
                recomendacao: 'Exija entrada mínima de 50% ou pagamento antecipado para mitigar riscos.'
            });
        }
        
        // Alerta 6: Margem líquida baixa
        if (resultados.margemLiquida < 20 && resultados.margemLiquida > 0) {
            alertas.push({
                tipo: 'warning',
                icone: '⚠️',
                titulo: 'Margem Líquida Baixa',
                mensagem: 'Margem líquida inferior a 20% - abaixo do recomendado.',
                recomendacao: 'Reavalie os custos, aumente o preço ou negocie melhores condições com fornecedores.'
            });
        }
        
        // Alerta 7: Parcelamento longo
        if (numParcelas > 12) {
            if (risco === 'Alto') {
                alertas.push({
                    tipo: 'danger',
                    icone: '⚠️',
                    titulo: 'Parcelamento de Alto Risco',
                    mensagem: 'Parcelamento longo para cliente de alto risco!',
                    recomendacao: 'Reduza o número de parcelas ou exija garantias adicionais.'
                });
            } else {
                alertas.push({
                    tipo: 'info',
                    icone: 'ℹ️',
                    titulo: 'Parcelamento Longo',
                    mensagem: 'Parcelamento superior a 12 meses aumenta a exposição financeira.',
                    recomendacao: 'Considere o custo do dinheiro no tempo ao definir o preço.'
                });
            }
        }
        
        // Alerta 8: Modelo híbrido sem definição
        if (modeloCobranca === 'Híbrido') {
            if (escopo.trim() === '' || escopo.length < 50) {
                alertas.push({
                    tipo: 'info',
                    icone: 'ℹ️',
                    titulo: 'Modelo Híbrido sem Definição Clara',
                    mensagem: 'O modelo híbrido precisa de definições separadas para parte fixa e variável.',
                    recomendacao: 'Detalhe no escopo: (1) Parte fixa: retainer/fechado e (2) Parte variável: êxito.'
                });
            }
        }
        
        // Alerta 9: Complexidade vs Preço
        if (complexidade === 'Alta' && resultados.margemLiquida < 25) {
            alertas.push({
                tipo: 'warning',
                icone: '⚠️',
                titulo: 'Alta Complexidade com Margem Baixa',
                mensagem: 'Projeto de alta complexidade com margem abaixo de 25%.',
                recomendacao: 'Revise o preço para compensar os riscos adicionais da alta complexidade.'
            });
        }
        
        // Alerta 10: Urgência sem adicional
        if (urgencia === 'Urgente' && resultados.margemLiquida < 30) {
            alertas.push({
                tipo: 'info',
                icone: 'ℹ️',
                titulo: 'Projeto Urgente',
                mensagem: 'Projeto com urgência deve ter margem maior para compensar a alocação prioritária.',
                recomendacao: 'Considere adicionar um adicional de urgência de 15-20% sobre o preço.'
            });
        }
        
        // Alerta 11: CS não aplicado
        if (aplicaCS === 'nao') {
            alertas.push({
                tipo: 'info',
                icone: 'ℹ️',
                titulo: 'CS não Aplicado',
                mensagem: 'Compensation System não está sendo aplicado nesta simulação.',
                recomendacao: 'Verifique se esta venda realmente não tem comissão ou se é um erro.'
            });
        }
        
        // Renderizar alertas
        if (alertas.length === 0) {
            alertasContainer.innerHTML = `
                <div class="alert alert-success" style="display: flex; align-items: center; gap: 10px;">
                    <span style="font-size: 24px;">✅</span>
                    <div>
                        <strong style="font-size: 16px;">Tudo OK!</strong>
                        <p style="margin-top: 5px;">Todos os parâmetros estão dentro do esperado. Nenhum alerta gerado.</p>
                    </div>
                </div>
            `;
        } else {
            alertas.forEach(alerta => {
                const alertaDiv = document.createElement('div');
                alertaDiv.className = `alert alert-${alerta.tipo}`;
                alertaDiv.style.display = 'flex';
                alertaDiv.style.alignItems = 'flex-start';
                alertaDiv.style.gap = '12px';
                
                alertaDiv.innerHTML = `
                    <span style="font-size: 24px;">${alerta.icone}</span>
                    <div style="flex: 1;">
                        <strong style="font-size: 15px; display: block; margin-bottom: 5px;">${alerta.titulo}</strong>
                        <p style="margin-bottom: 8px; font-size: 14px;">${alerta.mensagem}</p>
                        <p style="font-size: 13px; color: ${alerta.tipo === 'danger' ? '#721c24' : (alerta.tipo === 'warning' ? '#856404' : '#0c5460')}; background: rgba(255,255,255,0.5); padding: 6px 10px; border-radius: 6px; margin-top: 5px;">
                            <strong>Recomendação:</strong> ${alerta.recomendacao}
                        </p>
                    </div>
                `;
                
                alertasContainer.appendChild(alertaDiv);
            });
        }
    }
};

const Sincronizacao = {
    agendarAutomatica: function() {
        if (syncTimeout) {
            clearTimeout(syncTimeout);
        }
        
        Calculadora.calcular();
        
        syncTimeout = setTimeout(() => {
            if (isOnline) {
                Sincronizacao.enviar(true);
            } else {
                Sincronizacao.adicionarFila();
                Sincronizacao.atualizarStatus('offline', 'Offline - Pendente');
                Utils.mostrarNotificacao('Offline. Dados serão sincronizados quando online.', 'warning');
            }
        }, 3000);
    },
    
    enviar: function(isAutoSave = false) {
        if (salvando) {
            if (!isAutoSave) Utils.mostrarNotificacao('Já está salvando. Aguarde...', 'warning');
            return;
        }
        
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL === 'SUA_URL_DO_WEB_APP_AQUI') {
            Utils.mostrarNotificacao('Configure a URL do Google Sheets no código!', 'error');
            return;
        }
        
        if (!isAutoSave) {
            const btnTexto = document.getElementById('btnEnviarTexto');
            const btnLoading = document.getElementById('btnEnviarLoading');
            const btn = document.getElementById('btnEnviar');
            if (btnTexto) btnTexto.style.display = 'none';
            if (btnLoading) btnLoading.style.display = 'inline-block';
            if (btn) btn.disabled = true;
        }
        
        this.atualizarStatus('syncing', 'Sincronizando...');
        
        const dadosCompletos = this.coletarDadosCompletos();
        
        this.enviarDados(dadosCompletos, isAutoSave)
            .then(() => {
                this.atualizarStatus('online', 'Sincronizado');
                
                if (!isAutoSave) {
                    const btnTexto = document.getElementById('btnEnviarTexto');
                    const btnLoading = document.getElementById('btnEnviarLoading');
                    const btn = document.getElementById('btnEnviar');
                    if (btnTexto) btnTexto.style.display = 'inline';
                    if (btnLoading) btnLoading.style.display = 'none';
                    if (btn) btn.disabled = false;
                    
                    if (editandoId) {
                        editandoId = null;
                        const badge = document.getElementById('editModeBadge');
                        if (badge) badge.classList.remove('active');
                        const btnCancelar = document.getElementById('btnCancelar');
                        if (btnCancelar) btnCancelar.style.display = 'none';
                    }
                    
                    setTimeout(() => {
                        if (confirm('Dados salvos! Ir para o histórico?')) {
                            UI.showTab('historico', document.querySelectorAll('.tab-btn')[4]);
                            setTimeout(Historico.carregar, 2000);
                        }
                    }, 500);
                }
            })
            .catch(() => {
                this.atualizarStatus('offline', 'Falha');
                this.adicionarFila();
                
                if (!isAutoSave) {
                    const btnTexto = document.getElementById('btnEnviarTexto');
                    const btnLoading = document.getElementById('btnEnviarLoading');
                    const btn = document.getElementById('btnEnviar');
                    if (btnTexto) btnTexto.style.display = 'inline';
                    if (btnLoading) btnLoading.style.display = 'none';
                    if (btn) btn.disabled = false;
                }
            });
    },
    
    enviarDados: function(dados, isAutoSave = false) {
        if (salvando) {
            console.log('Já está salvando, ignorando...');
            return Promise.reject('Já salvando');
        }
        
        const agora = Date.now();
        if (agora - ultimoSalvamento < 2000) {
            console.log('Salvamento muito recente, ignorando...');
            return Promise.reject('Salvamento recente');
        }
        
        salvando = true;
        
        return new Promise((resolve, reject) => {
            fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(dados)
            })
            .then(() => {
                ultimoSalvamento = Date.now();
                if (!isAutoSave) {
                    Utils.mostrarNotificacao('✅ Dados salvos com sucesso!', 'success');
                }
                salvando = false;
                resolve();
            })
            .catch(error => {
                salvando = false;
                if (!isAutoSave) {
                    Utils.mostrarNotificacao('❌ Erro ao salvar: ' + error.message, 'error');
                }
                reject(error);
            });
        });
    },
    
    coletarDadosCompletos: function() {
        const resultadosAtuais = Calculadora.calcular();
        
        const dadosInput = {
            cliente: document.getElementById('cliente_nome')?.value || '',
            segmento: document.getElementById('segmento')?.value || '',
            tipo: document.getElementById('tipo_cliente')?.value || 'Novo',
            risco: document.getElementById('risco_inadimplencia')?.value || 'Médio',
            produto: document.getElementById('produto')?.value || 'Consultoria Estratégica',
            escopo: document.getElementById('escopo')?.value || '',
            complexidade: document.getElementById('complexidade')?.value || 'Média',
            urgencia: document.getElementById('urgencia')?.value || 'Normal',
            modeloCobranca: document.querySelector('input[name="modelo_cobranca"]:checked')?.value || 'Hora',
            entrada: Utils.parseFloatSafe(document.getElementById('entrada')?.value, 30),
            parcelas: parseInt(document.getElementById('parcelas')?.value) || 6,
            desconto: Utils.parseFloatSafe(document.getElementById('desconto')?.value, 0),
            temParceiro: document.getElementById('tem_parceiro')?.value || 'nao',
            percentualParceiro: document.getElementById('tem_parceiro')?.value === 'sim' ? 
                Utils.parseFloatSafe(document.getElementById('percentual_parceiro')?.value, 0) : 0,
            aplicaCS: document.getElementById('aplica_cs')?.value || 'sim',
            percentualCS: document.getElementById('aplica_cs')?.value === 'sim' ? 
                Utils.parseFloatSafe(document.getElementById('percentual_cs')?.value, 7.5) : 0
        };
        
        let perfisArray = [];
        document.querySelectorAll('.perfil-row').forEach(row => {
            const nome = row.querySelector('.perfil-nome')?.value;
            const horas = Utils.parseFloatSafe(row.querySelector('.perfil-horas')?.value, 0);
            if (nome && horas > 0) {
                perfisArray.push({ nome, horas });
            }
        });
        
        if (perfisArray.length === 0) {
            perfisArray = [
                { nome: 'Pl', horas: 80 },
                { nome: 'Jr', horas: 40 }
            ];
        }
        
        return {
            action: 'salvar',
            timestamp: new Date().toISOString(),
            input: dadosInput,
            perfis: perfisArray,
            resultados: {
                custoDireto: resultadosAtuais.custoDireto || 0,
                custoTotal: resultadosAtuais.custoTotal || 0,
                custoParcelamento: resultadosAtuais.custoParcelamento || 0,
                precoPiso: resultadosAtuais.precoPiso || 0,
                precoAlvo: resultadosAtuais.precoAlvo || 0,
                precoPremium: resultadosAtuais.precoPremium || 0,
                margemPiso: resultadosAtuais.margemPiso || 0,
                margemAlvo: resultadosAtuais.margemAlvo || 0,
                margemPremium: resultadosAtuais.margemPremium || 0,
                margemLiquida: resultadosAtuais.margemLiquida || 0,
                impostos: resultadosAtuais.impostos || 0,
                cs: resultadosAtuais.cs || 0,
                parceiro: resultadosAtuais.parceiro || 0,
                receitaLiquida: resultadosAtuais.receitaLiquida || 0
            }
        };
    },
    
    testar: function() {
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL === 'SUA_URL_DO_WEB_APP_AQUI') {
            Utils.mostrarNotificacao('URL do Google Sheets não configurada!', 'error');
            this.atualizarStatus('offline', 'Não configurado');
            return;
        }
        
        fetch(GOOGLE_SHEETS_URL + '?action=test')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    this.atualizarStatus('online', 'Sincronizado');
                    Utils.mostrarNotificacao('Conexão estabelecida!', 'success');
                    
                    const savedQueue = localStorage.getItem('syncQueue');
                    if (savedQueue) {
                        try {
                            syncQueue = JSON.parse(savedQueue) || [];
                            if (syncQueue.length > 0) this.processarFila();
                        } catch (e) {
                            console.error('Erro ao carregar fila:', e);
                        }
                    }
                } else {
                    this.atualizarStatus('offline', 'Offline');
                    Utils.mostrarNotificacao('Erro ao conectar', 'error');
                }
            })
            .catch(error => {
                this.atualizarStatus('offline', 'Offline');
                Utils.mostrarNotificacao('Falha na conexão: ' + error.message, 'error');
            });
    },
    
    testarSilenciosa: function() {
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL === 'SUA_URL_DO_WEB_APP_AQUI') {
            this.atualizarStatus('offline', 'Não configurado');
            return;
        }
        
        fetch(GOOGLE_SHEETS_URL + '?action=test')
            .then(response => {
                if (response.ok) {
                    this.atualizarStatus('online', 'Sincronizado');
                    isOnline = true;
                    
                    const savedQueue = localStorage.getItem('syncQueue');
                    if (savedQueue) {
                        try {
                            syncQueue = JSON.parse(savedQueue) || [];
                            if (syncQueue.length > 0) this.processarFila();
                        } catch (e) {
                            console.error('Erro ao carregar fila:', e);
                        }
                    }
                } else {
                    this.atualizarStatus('offline', 'Offline');
                    isOnline = false;
                }
            })
            .catch(() => {
                this.atualizarStatus('offline', 'Offline');
                isOnline = false;
            });
    },
    
    adicionarFila: function() {
        const dadosAtuais = this.coletarDadosCompletos();
        
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
    },
    
    processarFila: async function() {
        if (syncQueue.length === 0 || salvando) return;
        
        salvando = true;
        this.atualizarStatus('syncing', `Sincronizando ${syncQueue.length}...`);
        
        const itensParaProcessar = [...syncQueue];
        let sucessos = 0, erros = 0;
        
        for (const item of itensParaProcessar) {
            try {
                await this.enviarDados(item.dados, true);
                sucessos++;
                syncQueue = syncQueue.filter(q => q.timestamp !== item.timestamp);
                await Utils.delay(500);
            } catch (error) {
                erros++;
            }
        }
        
        localStorage.setItem('syncQueue', JSON.stringify(syncQueue));
        salvando = false;
        
        if (erros === 0) {
            this.atualizarStatus('online', 'Sincronizado');
            if (sucessos > 0) {
                Utils.mostrarNotificacao(`${sucessos} ${sucessos === 1 ? 'item' : 'itens'} sincronizado${sucessos === 1 ? '' : 's'}!`, 'success');
            }
        } else {
            this.atualizarStatus('online', 'Parcial');
            Utils.mostrarNotificacao(`${sucessos} sucessos, ${erros} erros`, 'warning');
        }
    },
    
    recriarCabecalho: function() {
        if (!confirm('Isso irá recriar o cabeçalho da planilha. Os dados existentes serão preservados. Continuar?')) {
            return;
        }
        
        Utils.mostrarNotificacao('Recriando cabeçalho...', 'info');
        
        fetch(GOOGLE_SHEETS_URL + '?action=recriarCabecalho')
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Utils.mostrarNotificacao('Cabeçalho recriado com sucesso!', 'success');
                    Historico.carregar();
                } else {
                    Utils.mostrarNotificacao('Erro ao recriar cabeçalho: ' + (data.error || 'Erro desconhecido'), 'error');
                }
            })
            .catch(error => {
                Utils.mostrarNotificacao('Erro ao recriar cabeçalho: ' + error.message, 'error');
            });
    },
    
    atualizarStatus: function(status, mensagem) {
        const dot = document.getElementById('syncDot');
        const text = document.getElementById('syncText');
        
        if (dot) dot.className = `sync-dot ${status}`;
        
        if (status === 'online') {
            if (text) text.textContent = mensagem || 'Online';
            isOnline = true;
        } else if (status === 'syncing') {
            if (text) text.textContent = mensagem || 'Sincronizando...';
        } else {
            if (text) text.textContent = mensagem || 'Offline';
            isOnline = false;
        }
    }
};

const Historico = {
    carregar: function() {
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL === 'SUA_URL_DO_WEB_APP_AQUI') {
            const lista = document.getElementById('historico-lista');
            if (lista) lista.innerHTML = '<tr><td colspan="13" style="text-align: center;">Configure a URL do Web App no código primeiro!</td></tr>';
            return;
        }
        
        const lista = document.getElementById('historico-lista');
        if (lista) {
            lista.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;"><div class="loading" style="border-top-color: #667eea;"></div> Carregando dados...</td></tr>';
        }
        
        fetch(GOOGLE_SHEETS_URL + '?action=carregarHistorico')
            .then(response => response.json())
            .then(data => {
                historicoCompleto = data || [];
                this.renderizar(historicoCompleto);
                
                const ultimaSync = document.getElementById('ultima-sincronizacao');
                if (ultimaSync) ultimaSync.textContent = new Date().toLocaleTimeString('pt-BR');
                
                if (historicoCompleto.length > 0) {
                    Utils.mostrarNotificacao(`${historicoCompleto.length} registros carregados!`, 'success');
                }
            })
            .catch(error => {
                const lista = document.getElementById('historico-lista');
                if (lista) {
                    lista.innerHTML = '<tr><td colspan="13" style="text-align: center; color: #f56565;">Erro ao carregar: ' + error.message + '</td></tr>';
                }
                Utils.mostrarNotificacao('Erro ao carregar histórico: ' + error.message, 'error');
            });
    },
    
    renderizar: function(dados) {
        const tbody = document.getElementById('historico-lista');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        const totalRegistros = document.getElementById('total-registros');
        if (totalRegistros) totalRegistros.textContent = dados.length;
        
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
                <td class="money">${Utils.formatarMoeda(item.precoAlvo)}</td>
                <td class="money">${Utils.formatarMoeda(item.custoTotal)}</td>
                <td class="percent">${(item.margemLiquida || 0).toFixed(1).replace('.', ',')}%</td>
                <td>
                    <span class="status-badge ${statusClass}" onclick="Historico.alterarStatus('${item.id}', this)">${item.status || 'Pendente'}</span>
                </td>
                <td>
                    <div class="action-buttons">
                        <button class="btn-primary" onclick="Historico.editar('${item.id}')" style="padding: 4px 8px;" title="Editar">✏️</button>
                        <button class="btn-danger" onclick="Historico.excluir('${item.id}')" style="padding: 4px 8px;" title="Excluir">🗑️</button>
                    </div>
                </td>
            `;
        });
    },
    
    limparVisualizacao: function() {
        if (confirm('Limpar visualização do histórico? Os dados no Google Sheets não serão afetados.')) {
            const lista = document.getElementById('historico-lista');
            if (lista) {
                lista.innerHTML = '<tr><td colspan="13" style="text-align: center; padding: 40px;">Visualização limpa. Clique em "Sincronizar" para recarregar.</td></tr>';
            }
            const totalRegistros = document.getElementById('total-registros');
            if (totalRegistros) totalRegistros.textContent = '0';
            Utils.mostrarNotificacao('Visualização limpa', 'info');
        }
    },
    
    exportarCSV: function() {
        if (historicoCompleto.length === 0) {
            Utils.mostrarNotificacao('Nenhum dado para exportar', 'warning');
            return;
        }
        
        let csv = 'ID,Data/Hora,Cliente,Segmento,Tipo,Risco,Produto,Modelo,Preço Alvo,Custo Total,Margem,Status\n';
        
        historicoCompleto.forEach(item => {
            const linha = [
                `"${item.id || ''}"`,
                `"${item.data || ''}"`,
                `"${item.cliente || ''}"`,
                `"${item.segmento || ''}"`,
                `"${item.tipo || ''}"`,
                `"${item.risco || ''}"`,
                `"${item.produto || ''}"`,
                `"${item.modelo || ''}"`,
                item.precoAlvo || 0,
                item.custoTotal || 0,
                item.margemLiquida || 0,
                `"${item.status || 'Pendente'}"`
            ].join(',');
            csv += linha + '\n';
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
        
        Utils.mostrarNotificacao('CSV exportado com sucesso!', 'success');
    },
    
    editar: function(id) {
        if (!confirm('Carregar esta simulação para edição?')) return;
        
        fetch(GOOGLE_SHEETS_URL + `?action=carregarSimulacao&id=${id}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    const sim = data.dados;
                    
                    editandoId = id;
                    const badge = document.getElementById('editModeBadge');
                    if (badge) badge.classList.add('active');
                    const btnCancelar = document.getElementById('btnCancelar');
                    if (btnCancelar) btnCancelar.style.display = 'inline-flex';
                    
                    // Preencher campos
                    const campoCliente = document.getElementById('cliente_nome');
                    if (campoCliente) campoCliente.value = sim.input.cliente || '';
                    
                    const campoSegmento = document.getElementById('segmento');
                    if (campoSegmento) campoSegmento.value = sim.input.segmento || '';
                    
                    const campoTipo = document.getElementById('tipo_cliente');
                    if (campoTipo) campoTipo.value = sim.input.tipo || 'Novo';
                    
                    const campoRisco = document.getElementById('risco_inadimplencia');
                    if (campoRisco) campoRisco.value = sim.input.risco || 'Médio';
                    
                    const campoProduto = document.getElementById('produto');
                    if (campoProduto) campoProduto.value = sim.input.produto || 'Consultoria Estratégica';
                    
                    const campoEscopo = document.getElementById('escopo');
                    if (campoEscopo) campoEscopo.value = sim.input.escopo || '';
                    
                    const campoComplexidade = document.getElementById('complexidade');
                    if (campoComplexidade) campoComplexidade.value = sim.input.complexidade || 'Média';
                    
                    const campoUrgencia = document.getElementById('urgencia');
                    if (campoUrgencia) campoUrgencia.value = sim.input.urgencia || 'Normal';
                    
                    document.querySelectorAll('input[name="modelo_cobranca"]').forEach(radio => {
                        radio.checked = (radio.value === sim.input.modeloCobranca);
                    });
                    
                    const campoEntrada = document.getElementById('entrada');
                    if (campoEntrada) campoEntrada.value = sim.input.entrada || 30;
                    
                    const campoParcelas = document.getElementById('parcelas');
                    if (campoParcelas) campoParcelas.value = sim.input.parcelas || 6;
                    
                    const campoDesconto = document.getElementById('desconto');
                    if (campoDesconto) campoDesconto.value = sim.input.desconto || 0;
                    
                    const campoTemParceiro = document.getElementById('tem_parceiro');
                    if (campoTemParceiro) campoTemParceiro.value = sim.input.temParceiro || 'nao';
                    
                    if (sim.input.temParceiro === 'sim') {
                        const parceiroGroup = document.getElementById('parceiro-group');
                        if (parceiroGroup) parceiroGroup.style.display = 'block';
                        const campoPercParceiro = document.getElementById('percentual_parceiro');
                        if (campoPercParceiro) campoPercParceiro.value = sim.input.percentualParceiro || 10;
                    } else {
                        const parceiroGroup = document.getElementById('parceiro-group');
                        if (parceiroGroup) parceiroGroup.style.display = 'none';
                    }
                    
                    const campoAplicaCS = document.getElementById('aplica_cs');
                    if (campoAplicaCS) campoAplicaCS.value = sim.input.aplicaCS || 'sim';
                    
                    if (sim.input.aplicaCS === 'sim') {
                        const csGroup = document.getElementById('cs-group');
                        if (csGroup) csGroup.style.display = 'block';
                        const campoPercCS = document.getElementById('percentual_cs');
                        if (campoPercCS) campoPercCS.value = sim.input.percentualCS || 7.5;
                    } else {
                        const csGroup = document.getElementById('cs-group');
                        if (csGroup) csGroup.style.display = 'none';
                    }
                    
                    const container = document.getElementById('perfis-container');
                    if (container) {
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
                                    <button type="button" class="btn-danger" onclick="Perfis.remover(this)" style="padding: 12px;">🗑️</button>
                                `;
                                container.appendChild(newRow);
                            });
                        } else {
                            // Perfis padrão
                            Perfis.adicionar();
                            Perfis.adicionar();
                        }
                    }
                    
                    Perfis.atualizarBuffer();
                    Calculadora.calcular();
                    
                    Utils.mostrarNotificacao('Simulação carregada para edição!', 'success');
                    UI.showTab('input', document.querySelectorAll('.tab-btn')[0]);
                    
                } else {
                    Utils.mostrarNotificacao('Erro ao carregar: ' + (data.error || 'Erro desconhecido'), 'error');
                }
            })
            .catch(error => {
                Utils.mostrarNotificacao('Erro ao carregar: ' + error.message, 'error');
            });
    },
    
    excluir: function(id) {
        if (!confirm('Excluir esta simulação permanentemente?')) return;
        
        fetch(GOOGLE_SHEETS_URL + `?action=excluirSimulacao&id=${id}`)
            .then(response => response.json())
            .then(data => {
                if (data.success) {
                    Utils.mostrarNotificacao('Simulação excluída!', 'success');
                    this.carregar();
                } else {
                    Utils.mostrarNotificacao('Erro ao excluir: ' + (data.error || 'Erro desconhecido'), 'error');
                }
            })
            .catch(error => {
                Utils.mostrarNotificacao('Erro ao excluir: ' + error.message, 'error');
            });
    },
    
    alterarStatus: function(id, elemento) {
        const statusAtual = elemento.textContent.trim();
        const opcoes = ['Pendente', 'Ganho', 'Perdido'];
        const proximoIndex = (opcoes.indexOf(statusAtual) + 1) % opcoes.length;
        const novoStatus = opcoes[proximoIndex];
        
        if (confirm(`Alterar status para "${novoStatus}"?`)) {
            elemento.textContent = novoStatus;
            elemento.className = `status-badge status-${novoStatus.toLowerCase()}`;
            
            Utils.mostrarNotificacao(`Status alterado para ${novoStatus}`, 'success');
        }
    }
};

const Edicao = {
    cancelar: function() {
        if (editandoId) {
            if (confirm('Cancelar edição? As alterações não salvas serão perdidas.')) {
                editandoId = null;
                const badge = document.getElementById('editModeBadge');
                if (badge) badge.classList.remove('active');
                const btnCancelar = document.getElementById('btnCancelar');
                if (btnCancelar) btnCancelar.style.display = 'none';
                location.reload();
            }
        }
    }
};

// ===========================================
// UTILITÁRIOS
// ===========================================
const Utils = {
    parseFloatSafe: function(valor, padrao = 0) {
        if (valor === undefined || valor === null) return padrao;
        const parsed = parseFloat(valor);
        return isNaN(parsed) ? padrao : parsed;
    },
    
    formatarMoeda: function(valor) {
        if (valor === undefined || valor === null || isNaN(valor)) return 'R$ 0,00';
        return 'R$ ' + valor.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    },
    
    formatarPercentual: function(valor) {
        if (valor === undefined || valor === null || isNaN(valor)) return '0,0%';
        return valor.toFixed(1).replace('.', ',') + '%';
    },
    
    setTextContent: function(id, texto) {
        const el = document.getElementById(id);
        if (el) el.textContent = texto;
    },
    
    mostrarNotificacao: function(mensagem, tipo = 'success') {
        const notification = document.createElement('div');
        notification.className = `notification ${tipo}`;
        notification.textContent = mensagem;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            notification.remove();
        }, 5000);
    },
    
    delay: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    atualizarContadorAutoSave: function() {
        const contador = document.getElementById('contadorAutoSave');
        if (contador) {
            if (syncTimeout) {
                const segundosRestantes = Math.ceil(syncTimeout._idleTimeout / 1000);
                contador.textContent = `⏳ Auto-save em ${segundosRestantes}s`;
            } else {
                contador.textContent = '';
            }
        }
    }
};

// ===========================================
// FUNÇÕES DE CONFIGURAÇÃO (Aliases para compatibilidade)
// ===========================================
function configurarAutoSave() {
    document.querySelectorAll('input, select, textarea').forEach(element => {
        element.addEventListener('input', Sincronizacao.agendarAutomatica);
        element.addEventListener('change', function() {
            if (this.id === 'complexidade' || this.id === 'urgencia') {
                Perfis.atualizarBuffer();
            }
            if (this.id === 'tem_parceiro') {
                toggleParceiro();
            }
            if (this.id === 'aplica_cs') {
                toggleCS();
            }
            Sincronizacao.agendarAutomatica();
        });
    });
    
    document.querySelectorAll('input[name="modelo_cobranca"]').forEach(radio => {
        radio.addEventListener('change', Sincronizacao.agendarAutomatica);
    });
}

function toggleParceiro() {
    const temParceiro = document.getElementById('tem_parceiro')?.value;
    const parceiroGroup = document.getElementById('parceiro-group');
    if (parceiroGroup) {
        parceiroGroup.style.display = temParceiro === 'sim' ? 'block' : 'none';
    }
    Calculadora.calcular();
}

function toggleCS() {
    const aplicaCS = document.getElementById('aplica_cs')?.value;
    const csGroup = document.getElementById('cs-group');
    if (csGroup) {
        csGroup.style.display = aplicaCS === 'sim' ? 'block' : 'none';
    }
    Calculadora.calcular();
}

// ===========================================
// INICIALIZAÇÃO
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    configurarAutoSave();
    Perfis.atualizarBuffer();
    Tabelas.atualizarCustosBase();
    setTimeout(Calculadora.calcular, 500);
    Sincronizacao.testar();
    setInterval(() => Sincronizacao.testarSilenciosa(), 30000);
    setInterval(Utils.atualizarContadorAutoSave, 1000);
    
    window.addEventListener('online', function() {
        Utils.mostrarNotificacao('Conexão restabelecida! Sincronizando...', 'success');
        Sincronizacao.processarFila();
    });
});