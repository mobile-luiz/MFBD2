// ===========================================
// MFBD PRECIFICAÇÃO ESTRATÉGICA - SCRIPT COMPLETO
// ===========================================
// VERSÃO: 3.0 - SALVA TODAS AS 4 ABAS NA PLANILHA
// ===========================================

// ===========================================
// CONFIGURAÇÕES
// ===========================================
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbxZ_cX9V39x4rWzJp_B6oONvm6i16qI-lXn3Apc80B7mRN7woBRxlctyv6oTDieWPNToQ/exec';

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
let historicoFiltrado = [];
let salvando = false;
let ultimoSalvamento = 0;
let paginaAtual = 1;
let itensPorPagina = 20;

// ===========================================
// FUNÇÕES GLOBAIS PARA ONCLICK
// ===========================================
window.toggleParceiro = function() {
    const temParceiro = document.getElementById('tem_parceiro')?.value;
    const parceiroGroup = document.getElementById('parceiro-group');
    if (parceiroGroup) {
        parceiroGroup.style.display = temParceiro === 'sim' ? 'block' : 'none';
    }
    if (typeof Calculadora !== 'undefined' && Calculadora.calcular) {
        Calculadora.calcular();
    }
};

window.toggleCS = function() {
    const aplicaCS = document.getElementById('aplica_cs')?.value;
    const csGroup = document.getElementById('cs-group');
    if (csGroup) {
        csGroup.style.display = aplicaCS === 'sim' ? 'block' : 'none';
    }
    if (typeof Calculadora !== 'undefined' && Calculadora.calcular) {
        Calculadora.calcular();
    }
};

// ===========================================
// LOGIN
// ===========================================
const Login = {
    usuarioAtual: null,
    
    entrar: function() {
        const email = document.getElementById('loginEmail')?.value.trim() || '';
        const senha = document.getElementById('loginSenha')?.value || '';
        const errorDiv = document.getElementById('loginError');
        const loginButton = document.getElementById('loginButton');
        const buttonText = document.getElementById('loginButtonText');
        const buttonLoading = document.getElementById('loginButtonLoading');
        
        if (!email || !senha) {
            if (errorDiv) {
                errorDiv.textContent = 'Preencha email e senha';
                errorDiv.classList.add('active');
            }
            return;
        }
        
        if (loginButton) loginButton.disabled = true;
        if (buttonText) buttonText.style.display = 'none';
        if (buttonLoading) buttonLoading.style.display = 'inline-block';
        if (errorDiv) errorDiv.classList.remove('active');
        
        this.usuarioAtual = email;
        const usuarioLogado = document.getElementById('usuarioLogado');
        if (usuarioLogado) usuarioLogado.textContent = email;
        localStorage.setItem('usuarioLogado', email);
        
        const loginContainer = document.getElementById('loginContainer');
        const mainContent = document.getElementById('mainContent');
        
        if (loginContainer) loginContainer.style.display = 'none';
        if (mainContent) mainContent.classList.add('active');
        
        this.inicializarAposLogin();
        Utils.mostrarNotificacao(`Bem-vindo, ${email}!`, 'success');
        
        if (loginButton) loginButton.disabled = false;
        if (buttonText) buttonText.style.display = 'inline';
        if (buttonLoading) buttonLoading.style.display = 'none';
    },
    
    sair: function() {
        this.usuarioAtual = null;
        localStorage.removeItem('usuarioLogado');
        
        const loginContainer = document.getElementById('loginContainer');
        const mainContent = document.getElementById('mainContent');
        const loginEmail = document.getElementById('loginEmail');
        const loginSenha = document.getElementById('loginSenha');
        
        if (loginContainer) loginContainer.style.display = 'flex';
        if (mainContent) mainContent.classList.remove('active');
        if (loginEmail) loginEmail.value = '';
        if (loginSenha) loginSenha.value = '';
    },
    
    verificarSessao: function() {
        const usuarioSalvo = localStorage.getItem('usuarioLogado');
        if (usuarioSalvo) {
            this.usuarioAtual = usuarioSalvo;
            const usuarioLogado = document.getElementById('usuarioLogado');
            if (usuarioLogado) usuarioLogado.textContent = usuarioSalvo;
            
            const loginContainer = document.getElementById('loginContainer');
            const mainContent = document.getElementById('mainContent');
            
            if (loginContainer) loginContainer.style.display = 'none';
            if (mainContent) mainContent.classList.add('active');
            
            this.inicializarAposLogin();
            return true;
        }
        return false;
    },
    
    inicializarAposLogin: function() {
        this.configurarEventos();
        Perfis.atualizarBuffer();
        Tabelas.carregar();
        setTimeout(() => Calculadora.calcular(), 500);
        Sincronizacao.testar();
        setInterval(() => Sincronizacao.testarSilenciosa(), 30000);
        setInterval(() => Utils.atualizarContadorAutoSave(), 1000);
        
        window.addEventListener('online', function() {
            Utils.mostrarNotificacao('Conexão restabelecida! Sincronizando...', 'success');
            Sincronizacao.processarFila();
        });
    },
    
    configurarEventos: function() {
        document.querySelectorAll('input, select, textarea').forEach(element => {
            element.removeEventListener('input', Sincronizacao.agendarAutomatica);
            element.removeEventListener('change', this.handleChange);
            
            element.addEventListener('input', Sincronizacao.agendarAutomatica);
            element.addEventListener('change', this.handleChange);
        });
        
        document.querySelectorAll('input[name="modelo_cobranca"]').forEach(radio => {
            radio.removeEventListener('change', Sincronizacao.agendarAutomatica);
            radio.addEventListener('change', Sincronizacao.agendarAutomatica);
        });
    },
    
    handleChange: function(e) {
        if (e.target.id === 'complexidade' || e.target.id === 'urgencia') {
            Perfis.atualizarBuffer();
        }
        if (e.target.id === 'tem_parceiro') {
            window.toggleParceiro();
        }
        if (e.target.id === 'aplica_cs') {
            window.toggleCS();
        }
        Sincronizacao.agendarAutomatica();
    }
};

// ===========================================
// UI
// ===========================================
const UI = {
    showTab: function(tabName, element) {
        document.querySelectorAll('.tab-content').forEach(tab => tab.classList.remove('active'));
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        
        const tabElement = document.getElementById(`tab-${tabName}`);
        if (tabElement) tabElement.classList.add('active');
        if (element) element.classList.add('active');
        
        if (tabName === 'historico' && typeof Historico !== 'undefined') {
            Historico.carregar();
        }
    }
};

// ===========================================
// PERFIS
// ===========================================
const Perfis = {
    adicionar: function() {
        const container = document.getElementById('perfis-container');
        if (!container) return;
        
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
            const row = botao.closest('.perfil-row');
            if (row) row.remove();
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
            if (input) input.value = buffer;
        });
    }
};

// ===========================================
// TABELAS - GERENCIAMENTO DE PARÂMETROS
// ===========================================
const Tabelas = {
    carregar: function() {
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('SUA_URL')) {
            this.carregarValoresPadrao();
            return;
        }
        
        fetch(GOOGLE_SHEETS_URL + '?action=carregarParametros')
            .then(response => response.json())
            .then(data => {
                if (data && data.success && data.dados) {
                    this.aplicarParametros(data.dados);
                    Utils.mostrarNotificacao('Parâmetros carregados da planilha!', 'success');
                } else {
                    this.carregarValoresPadrao();
                }
            })
            .catch(error => {
                console.error('Erro ao carregar parâmetros:', error);
                this.carregarValoresPadrao();
            });
    },
    
    carregarValoresPadrao: function() {
        const valoresPadrao = {
            custo_estagio: 2500, custo_jr: 5000, custo_pl: 8000, custo_sr: 12000, custo_coord: 15000, custo_socio: 20000,
            horas_estagio: 150, horas_jr: 150, horas_pl: 150, horas_sr: 150, horas_coord: 150, horas_socio: 150,
            overhead_hora: 20,
            margem_piso_hora: 40, margem_alvo_hora: 55, margem_premium_hora: 65,
            margem_piso_fechado: 35, margem_alvo_fechado: 50, margem_premium_fechado: 60,
            margem_piso_retainer: 45, margem_alvo_retainer: 60, margem_premium_retainer: 70,
            margem_piso_exito: 50, margem_alvo_exito: 70, margem_premium_exito: 80,
            imposto: 6, taxa_pagamento: 2.5, juros_parcelamento: 1, cs_padrao: 7.5,
            buffer_complexidade_baixa: 10, buffer_complexidade_media: 20, buffer_complexidade_alta: 30,
            buffer_urgencia_normal: 0, buffer_urgencia_urgente: 20
        };
        this.aplicarParametros(valoresPadrao);
    },
    
    aplicarParametros: function(p) {
        if (!p) return;
        
        this.setValor('custo_estagio', p.custo_estagio);
        this.setValor('custo_jr', p.custo_jr);
        this.setValor('custo_pl', p.custo_pl);
        this.setValor('custo_sr', p.custo_sr);
        this.setValor('custo_coord', p.custo_coord);
        this.setValor('custo_socio', p.custo_socio);
        
        this.setValor('horas_estagio', p.horas_estagio);
        this.setValor('horas_jr', p.horas_jr);
        this.setValor('horas_pl', p.horas_pl);
        this.setValor('horas_sr', p.horas_sr);
        this.setValor('horas_coord', p.horas_coord);
        this.setValor('horas_socio', p.horas_socio);
        
        this.setValor('overhead_hora', p.overhead_hora);
        
        this.setValor('margem_piso_hora', p.margem_piso_hora);
        this.setValor('margem_alvo_hora', p.margem_alvo_hora);
        this.setValor('margem_premium_hora', p.margem_premium_hora);
        
        this.setValor('margem_piso_fechado', p.margem_piso_fechado);
        this.setValor('margem_alvo_fechado', p.margem_alvo_fechado);
        this.setValor('margem_premium_fechado', p.margem_premium_fechado);
        
        this.setValor('margem_piso_retainer', p.margem_piso_retainer);
        this.setValor('margem_alvo_retainer', p.margem_alvo_retainer);
        this.setValor('margem_premium_retainer', p.margem_premium_retainer);
        
        this.setValor('margem_piso_exito', p.margem_piso_exito);
        this.setValor('margem_alvo_exito', p.margem_alvo_exito);
        this.setValor('margem_premium_exito', p.margem_premium_exito);
        
        this.setValor('imposto', p.imposto);
        this.setValor('taxa_pagamento', p.taxa_pagamento);
        this.setValor('juros_parcelamento', p.juros_parcelamento);
        this.setValor('cs_padrao', p.cs_padrao);
        
        this.setValor('buffer_complexidade_baixa', p.buffer_complexidade_baixa);
        this.setValor('buffer_complexidade_media', p.buffer_complexidade_media);
        this.setValor('buffer_complexidade_alta', p.buffer_complexidade_alta);
        this.setValor('buffer_urgencia_normal', p.buffer_urgencia_normal);
        this.setValor('buffer_urgencia_urgente', p.buffer_urgencia_urgente);
        
        this.atualizarCustosBase();
        Calculadora.calcular();
        Perfis.atualizarBuffer();
    },
    
    setValor: function(id, valor) {
        const el = document.getElementById(id);
        if (el && valor !== undefined && valor !== null) {
            el.value = valor;
        }
    },
    
    salvar: function() {
        const dados = {
            action: 'salvarParametros',
            dados: this.coletarDados()
        };
        
        Utils.mostrarNotificacao('Salvando parâmetros...', 'info');
        
        fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dados)
        })
        .then(() => {
            Utils.mostrarNotificacao('✅ Parâmetros salvos na planilha!', 'success');
        })
        .catch(error => {
            Utils.mostrarNotificacao('❌ Erro ao salvar: ' + error.message, 'error');
        });
    },
    
    coletarDados: function() {
        return {
            custo_estagio: Utils.parseFloatSafe(document.getElementById('custo_estagio')?.value, 2500),
            custo_jr: Utils.parseFloatSafe(document.getElementById('custo_jr')?.value, 5000),
            custo_pl: Utils.parseFloatSafe(document.getElementById('custo_pl')?.value, 8000),
            custo_sr: Utils.parseFloatSafe(document.getElementById('custo_sr')?.value, 12000),
            custo_coord: Utils.parseFloatSafe(document.getElementById('custo_coord')?.value, 15000),
            custo_socio: Utils.parseFloatSafe(document.getElementById('custo_socio')?.value, 20000),
            
            horas_estagio: Utils.parseFloatSafe(document.getElementById('horas_estagio')?.value, 150),
            horas_jr: Utils.parseFloatSafe(document.getElementById('horas_jr')?.value, 150),
            horas_pl: Utils.parseFloatSafe(document.getElementById('horas_pl')?.value, 150),
            horas_sr: Utils.parseFloatSafe(document.getElementById('horas_sr')?.value, 150),
            horas_coord: Utils.parseFloatSafe(document.getElementById('horas_coord')?.value, 150),
            horas_socio: Utils.parseFloatSafe(document.getElementById('horas_socio')?.value, 150),
            
            overhead_hora: Utils.parseFloatSafe(document.getElementById('overhead_hora')?.value, 20),
            
            margem_piso_hora: Utils.parseFloatSafe(document.getElementById('margem_piso_hora')?.value, 40),
            margem_alvo_hora: Utils.parseFloatSafe(document.getElementById('margem_alvo_hora')?.value, 55),
            margem_premium_hora: Utils.parseFloatSafe(document.getElementById('margem_premium_hora')?.value, 65),
            
            margem_piso_fechado: Utils.parseFloatSafe(document.getElementById('margem_piso_fechado')?.value, 35),
            margem_alvo_fechado: Utils.parseFloatSafe(document.getElementById('margem_alvo_fechado')?.value, 50),
            margem_premium_fechado: Utils.parseFloatSafe(document.getElementById('margem_premium_fechado')?.value, 60),
            
            margem_piso_retainer: Utils.parseFloatSafe(document.getElementById('margem_piso_retainer')?.value, 45),
            margem_alvo_retainer: Utils.parseFloatSafe(document.getElementById('margem_alvo_retainer')?.value, 60),
            margem_premium_retainer: Utils.parseFloatSafe(document.getElementById('margem_premium_retainer')?.value, 70),
            
            margem_piso_exito: Utils.parseFloatSafe(document.getElementById('margem_piso_exito')?.value, 50),
            margem_alvo_exito: Utils.parseFloatSafe(document.getElementById('margem_alvo_exito')?.value, 70),
            margem_premium_exito: Utils.parseFloatSafe(document.getElementById('margem_premium_exito')?.value, 80),
            
            imposto: Utils.parseFloatSafe(document.getElementById('imposto')?.value, 6),
            taxa_pagamento: Utils.parseFloatSafe(document.getElementById('taxa_pagamento')?.value, 2.5),
            juros_parcelamento: Utils.parseFloatSafe(document.getElementById('juros_parcelamento')?.value, 1),
            cs_padrao: Utils.parseFloatSafe(document.getElementById('cs_padrao')?.value, 7.5),
            
            buffer_complexidade_baixa: Utils.parseFloatSafe(document.getElementById('buffer_complexidade_baixa')?.value, 10),
            buffer_complexidade_media: Utils.parseFloatSafe(document.getElementById('buffer_complexidade_media')?.value, 20),
            buffer_complexidade_alta: Utils.parseFloatSafe(document.getElementById('buffer_complexidade_alta')?.value, 30),
            buffer_urgencia_normal: Utils.parseFloatSafe(document.getElementById('buffer_urgencia_normal')?.value, 0),
            buffer_urgencia_urgente: Utils.parseFloatSafe(document.getElementById('buffer_urgencia_urgente')?.value, 20)
        };
    },
    
    atualizar: function() {
        this.atualizarCustosBase();
        Utils.mostrarNotificacao('Parâmetros atualizados no frontend!', 'success');
        Calculadora.calcular();
        Perfis.atualizarBuffer();
    },
    
    atualizarESalvar: function() {
        this.atualizarCustosBase();
        this.salvar();
        Calculadora.calcular();
        Perfis.atualizarBuffer();
    },
    
    atualizarCustosBase: function() {
        const overheadHora = Utils.parseFloatSafe(document.getElementById('overhead_hora')?.value, 20);
        
        const perfis = ['estagio', 'jr', 'pl', 'sr', 'coord', 'socio'];
        perfis.forEach(perfil => {
            const custo = Utils.parseFloatSafe(document.getElementById(`custo_${perfil}`)?.value, 
                perfil === 'estagio' ? 2500 : perfil === 'jr' ? 5000 : perfil === 'pl' ? 8000 : 
                perfil === 'sr' ? 12000 : perfil === 'coord' ? 15000 : 20000);
            const horas = Utils.parseFloatSafe(document.getElementById(`horas_${perfil}`)?.value, 150);
            
            if (horas > 0) {
                const custoBase = custo / horas;
                
                const elBase = document.getElementById(`custo_base_${perfil}`);
                if (elBase) elBase.textContent = Utils.formatarMoeda(custoBase);
                
                const custoCompleto = custoBase + overheadHora;
                const elCompleto = document.getElementById(`custo_completo_${perfil}`);
                if (elCompleto) elCompleto.textContent = Utils.formatarMoeda(custoCompleto);
            }
        });
    }
};

// ===========================================
// CALCULADORA
// ===========================================
const Calculadora = {
    calcular: function() {
        try {
            const overheadHora = Utils.parseFloatSafe(document.getElementById('overhead_hora')?.value, 20);
            
            const horasEstagio = Utils.parseFloatSafe(document.getElementById('horas_estagio')?.value, 150);
            const horasJr = Utils.parseFloatSafe(document.getElementById('horas_jr')?.value, 150);
            const horasPl = Utils.parseFloatSafe(document.getElementById('horas_pl')?.value, 150);
            const horasSr = Utils.parseFloatSafe(document.getElementById('horas_sr')?.value, 150);
            const horasCoord = Utils.parseFloatSafe(document.getElementById('horas_coord')?.value, 150);
            const horasSocio = Utils.parseFloatSafe(document.getElementById('horas_socio')?.value, 150);
            
            const custosPerfil = {
                'Estágio': (Utils.parseFloatSafe(document.getElementById('custo_estagio')?.value, 2500) / (horasEstagio || 1)) + overheadHora,
                'Jr': (Utils.parseFloatSafe(document.getElementById('custo_jr')?.value, 5000) / (horasJr || 1)) + overheadHora,
                'Pl': (Utils.parseFloatSafe(document.getElementById('custo_pl')?.value, 8000) / (horasPl || 1)) + overheadHora,
                'Sr': (Utils.parseFloatSafe(document.getElementById('custo_sr')?.value, 12000) / (horasSr || 1)) + overheadHora,
                'Coord': (Utils.parseFloatSafe(document.getElementById('custo_coord')?.value, 15000) / (horasCoord || 1)) + overheadHora,
                'Sócio': (Utils.parseFloatSafe(document.getElementById('custo_socio')?.value, 20000) / (horasSocio || 1)) + overheadHora
            };

            let custoDiretoTotal = 0;
            let totalHoras = 0;
            let perfisArray = [];
            
            document.querySelectorAll('.perfil-row').forEach(row => {
                const perfilSelect = row.querySelector('.perfil-nome');
                const horasInput = row.querySelector('.perfil-horas');
                
                const perfil = perfilSelect?.value || 'Pl';
                const horas = Utils.parseFloatSafe(horasInput?.value, 0);
                const custoHora = custosPerfil[perfil] || 0;
                
                if (horas > 0) {
                    totalHoras += horas;
                    custoDiretoTotal += custoHora * horas;
                    
                    perfisArray.push({
                        nome: perfil,
                        horas: horas,
                        custoHora: custoHora,
                        custoTotal: custoHora * horas
                    });
                }
            });

            if (totalHoras === 0) {
                Utils.mostrarNotificacao('Adicione horas nos perfis!', 'warning');
                return resultados;
            }

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
                case 'Retainer + Êxito':
                case 'Fechado + Êxito':
                    margemPiso = modeloCobranca.includes('Retainer') ? 
                        Utils.parseFloatSafe(document.getElementById('margem_piso_retainer')?.value, 45) / 100 :
                        Utils.parseFloatSafe(document.getElementById('margem_piso_fechado')?.value, 35) / 100;
                    margemAlvo = modeloCobranca.includes('Retainer') ? 
                        Utils.parseFloatSafe(document.getElementById('margem_alvo_retainer')?.value, 60) / 100 :
                        Utils.parseFloatSafe(document.getElementById('margem_alvo_fechado')?.value, 50) / 100;
                    margemPremium = modeloCobranca.includes('Retainer') ? 
                        Utils.parseFloatSafe(document.getElementById('margem_premium_retainer')?.value, 70) / 100 :
                        Utils.parseFloatSafe(document.getElementById('margem_premium_fechado')?.value, 60) / 100;
                    break;
            }

            const precoPiso = custoTotal / (1 - margemPiso);
            const precoAlvo = custoTotal / (1 - margemAlvo);
            const precoPremium = custoTotal / (1 - margemPremium);

            const numParcelas = parseInt(document.getElementById('parcelas')?.value) || 6;
            const jurosParcelamento = Utils.parseFloatSafe(document.getElementById('juros_parcelamento')?.value, 1) / 100;
            
            let custoParcelamento = 0;
            
            if (numParcelas > 1 && jurosParcelamento > 0 && precoAlvo > 0) {
                const valorParcela = precoAlvo / numParcelas;
                let valorPresente = 0;
                for (let i = 1; i <= numParcelas; i++) {
                    valorPresente += valorParcela / Math.pow(1 + jurosParcelamento, i);
                }
                custoParcelamento = precoAlvo - valorPresente;
            }

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
        if (complexidade === 'Baixa') bufferComplexidade = Utils.parseFloatSafe(document.getElementById('buffer_complexidade_baixa')?.value, 10);
        else if (complexidade === 'Média') bufferComplexidade = Utils.parseFloatSafe(document.getElementById('buffer_complexidade_media')?.value, 20);
        else if (complexidade === 'Alta') bufferComplexidade = Utils.parseFloatSafe(document.getElementById('buffer_complexidade_alta')?.value, 30);
        
        let bufferUrgencia = 0;
        if (urgencia === 'Normal') bufferUrgencia = Utils.parseFloatSafe(document.getElementById('buffer_urgencia_normal')?.value, 0);
        else if (urgencia === 'Urgente') bufferUrgencia = Utils.parseFloatSafe(document.getElementById('buffer_urgencia_urgente')?.value, 20);
        
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

// ===========================================
// ALERTAS
// ===========================================
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
        
        if (resultados.precoPiso > 0 && precoComDesconto < resultados.precoPiso) {
            alertas.push({
                tipo: 'danger',
                icone: '⚠️',
                titulo: 'Preço Abaixo do Piso',
                mensagem: 'O preço com desconto está abaixo do mínimo recomendado!',
                recomendacao: 'Ajuste o desconto para no máximo ' + 
                    (((resultados.precoPiso / resultados.precoAlvo) * 100).toFixed(1)) + '% para manter-se acima do piso.'
            });
        }
        
        if (desconto > 0.15) {
            alertas.push({
                tipo: 'warning',
                icone: '⚠️',
                titulo: 'Desconto Acima da Alçada',
                mensagem: 'Desconto superior a 15% precisa de aprovação da diretoria!',
                recomendacao: 'Solicite aprovação formal antes de prosseguir com a negociação.'
            });
        }
        
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
        
        if (modeloCobranca === 'Retainer') {
            if (!escopo || escopo.trim() === '' || escopo.length < 30) {
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
        
        if (modeloCobranca === 'Retainer + Êxito' || modeloCobranca === 'Fechado + Êxito') {
            if (!escopo || escopo.trim() === '' || escopo.length < 50) {
                alertas.push({
                    tipo: 'info',
                    icone: 'ℹ️',
                    titulo: 'Modelo Híbrido sem Definição Clara',
                    mensagem: `O modelo ${modeloCobranca} precisa de definições separadas para parte fixa e variável.`,
                    recomendacao: `Detalhe no escopo: (1) Parte fixa (${modeloCobranca.split(' + ')[0]}) e (2) Parte variável (Êxito) com metas e gatilhos.`
                });
            }
            
            if (entrada < 20) {
                alertas.push({
                    tipo: 'warning',
                    icone: '⚠️',
                    titulo: 'Entrada Baixa para Modelo Híbrido',
                    mensagem: 'Modelo híbrido com entrada muito baixa aumenta o risco.',
                    recomendacao: 'Considere aumentar a entrada para pelo menos 20-30% para cobrir custos iniciais.'
                });
            }
        }
        
        if (risco === 'Alto') {
            alertas.push({
                tipo: 'warning',
                icone: '⚠️',
                titulo: 'Cliente de Alto Risco',
                mensagem: 'Cliente classificado como alto risco de inadimplência!',
                recomendacao: 'Exija entrada mínima de 50% ou pagamento antecipado para mitigar riscos.'
            });
        }
        
        if (resultados.margemLiquida > 0 && resultados.margemLiquida < 20) {
            alertas.push({
                tipo: 'warning',
                icone: '⚠️',
                titulo: 'Margem Líquida Baixa',
                mensagem: 'Margem líquida inferior a 20% - abaixo do recomendado.',
                recomendacao: 'Reavalie os custos, aumente o preço ou negocie melhores condições com fornecedores.'
            });
        }
        
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
        
        if (complexidade === 'Alta' && resultados.margemLiquida < 25) {
            alertas.push({
                tipo: 'warning',
                icone: '⚠️',
                titulo: 'Alta Complexidade com Margem Baixa',
                mensagem: 'Projeto de alta complexidade com margem abaixo de 25%.',
                recomendacao: 'Revise o preço para compensar os riscos adicionais da alta complexidade.'
            });
        }
        
        if (urgencia === 'Urgente' && resultados.margemLiquida < 30) {
            alertas.push({
                tipo: 'info',
                icone: 'ℹ️',
                titulo: 'Projeto Urgente',
                mensagem: 'Projeto com urgência deve ter margem maior para compensar a alocação prioritária.',
                recomendacao: 'Considere adicionar um adicional de urgência de 15-20% sobre o preço.'
            });
        }
        
        if (aplicaCS === 'nao') {
            alertas.push({
                tipo: 'info',
                icone: 'ℹ️',
                titulo: 'CS não Aplicado',
                mensagem: 'Compensation System não está sendo aplicado nesta simulação.',
                recomendacao: 'Verifique se esta venda realmente não tem comissão ou se é um erro.'
            });
        }
        
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

// ===========================================
// SINCRONIZAÇÃO - ENVIA TODOS OS DADOS DAS 4 ABAS
// ===========================================
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
        
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('SUA_URL')) {
            Utils.mostrarNotificacao('Configure a URL do Google Sheets no código!', 'error');
            this.adicionarFila();
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
                            const historicoTab = document.querySelectorAll('.tab-btn')[4];
                            if (historicoTab) {
                                UI.showTab('historico', historicoTab);
                                setTimeout(() => Historico.carregar(), 2000);
                            }
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
            return Promise.reject('Já salvando');
        }
        
        const agora = Date.now();
        if (agora - ultimoSalvamento < 2000) {
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
    
    // ===========================================
    // COLETA TODOS OS DADOS DAS 4 ABAS
    // ===========================================
    coletarDadosCompletos: function() {
        const resultadosAtuais = Calculadora.calcular();
        
        // ===== 1. 📝 INPUT - DADOS DO CLIENTE E SERVIÇO =====
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

        // ===== 2. 📝 INPUT - PERFIS =====
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

        // ===== 3. 📊 TABELAS - TODOS OS PARÂMETROS =====
        const dadosTabelas = {
            // Custos
            custo_estagio: Utils.parseFloatSafe(document.getElementById('custo_estagio')?.value, 2500),
            custo_jr: Utils.parseFloatSafe(document.getElementById('custo_jr')?.value, 5000),
            custo_pl: Utils.parseFloatSafe(document.getElementById('custo_pl')?.value, 8000),
            custo_sr: Utils.parseFloatSafe(document.getElementById('custo_sr')?.value, 12000),
            custo_coord: Utils.parseFloatSafe(document.getElementById('custo_coord')?.value, 15000),
            custo_socio: Utils.parseFloatSafe(document.getElementById('custo_socio')?.value, 20000),
            
            // Horas
            horas_estagio: Utils.parseFloatSafe(document.getElementById('horas_estagio')?.value, 150),
            horas_jr: Utils.parseFloatSafe(document.getElementById('horas_jr')?.value, 150),
            horas_pl: Utils.parseFloatSafe(document.getElementById('horas_pl')?.value, 150),
            horas_sr: Utils.parseFloatSafe(document.getElementById('horas_sr')?.value, 150),
            horas_coord: Utils.parseFloatSafe(document.getElementById('horas_coord')?.value, 150),
            horas_socio: Utils.parseFloatSafe(document.getElementById('horas_socio')?.value, 150),
            
            // Overhead
            overhead_hora: Utils.parseFloatSafe(document.getElementById('overhead_hora')?.value, 20),
            
            // Margens Hora
            margem_piso_hora: Utils.parseFloatSafe(document.getElementById('margem_piso_hora')?.value, 40),
            margem_alvo_hora: Utils.parseFloatSafe(document.getElementById('margem_alvo_hora')?.value, 55),
            margem_premium_hora: Utils.parseFloatSafe(document.getElementById('margem_premium_hora')?.value, 65),
            
            // Margens Fechado
            margem_piso_fechado: Utils.parseFloatSafe(document.getElementById('margem_piso_fechado')?.value, 35),
            margem_alvo_fechado: Utils.parseFloatSafe(document.getElementById('margem_alvo_fechado')?.value, 50),
            margem_premium_fechado: Utils.parseFloatSafe(document.getElementById('margem_premium_fechado')?.value, 60),
            
            // Margens Retainer
            margem_piso_retainer: Utils.parseFloatSafe(document.getElementById('margem_piso_retainer')?.value, 45),
            margem_alvo_retainer: Utils.parseFloatSafe(document.getElementById('margem_alvo_retainer')?.value, 60),
            margem_premium_retainer: Utils.parseFloatSafe(document.getElementById('margem_premium_retainer')?.value, 70),
            
            // Margens Êxito
            margem_piso_exito: Utils.parseFloatSafe(document.getElementById('margem_piso_exito')?.value, 50),
            margem_alvo_exito: Utils.parseFloatSafe(document.getElementById('margem_alvo_exito')?.value, 70),
            margem_premium_exito: Utils.parseFloatSafe(document.getElementById('margem_premium_exito')?.value, 80),
            
            // Impostos e Taxas
            imposto: Utils.parseFloatSafe(document.getElementById('imposto')?.value, 6),
            taxa_pagamento: Utils.parseFloatSafe(document.getElementById('taxa_pagamento')?.value, 2.5),
            juros_parcelamento: Utils.parseFloatSafe(document.getElementById('juros_parcelamento')?.value, 1),
            cs_padrao: Utils.parseFloatSafe(document.getElementById('cs_padrao')?.value, 7.5),
            
            // Buffers
            buffer_complexidade_baixa: Utils.parseFloatSafe(document.getElementById('buffer_complexidade_baixa')?.value, 10),
            buffer_complexidade_media: Utils.parseFloatSafe(document.getElementById('buffer_complexidade_media')?.value, 20),
            buffer_complexidade_alta: Utils.parseFloatSafe(document.getElementById('buffer_complexidade_alta')?.value, 30),
            buffer_urgencia_normal: Utils.parseFloatSafe(document.getElementById('buffer_urgencia_normal')?.value, 0),
            buffer_urgencia_urgente: Utils.parseFloatSafe(document.getElementById('buffer_urgencia_urgente')?.value, 20)
        };

        // ===== 4. 🧮 CÁLCULO E 📤 OUTPUT - RESULTADOS =====
        return {
            action: 'salvar',
            timestamp: new Date().toISOString(),
            usuario: Login.usuarioAtual || 'anonimo',
            input: dadosInput,
            perfis: perfisArray,
            resultados: {
                // Resultados do cálculo
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
                receitaLiquida: resultadosAtuais.receitaLiquida || 0,
                margemLiquidaR$: resultadosAtuais.margemLiquidaR$ || 0,
                // Parâmetros das tabelas
                ...dadosTabelas
            }
        };
    },
    
    testar: function() {
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('SUA_URL')) {
            Utils.mostrarNotificacao('URL do Google Sheets não configurada!', 'error');
            this.atualizarStatus('offline', 'Não configurado');
            return;
        }
        
        fetch(GOOGLE_SHEETS_URL + '?action=test')
            .then(response => {
                if (response.ok) {
                    return response.json();
                }
                throw new Error('Resposta não OK');
            })
            .then(data => {
                if (data && data.success) {
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
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('SUA_URL')) {
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
                if (data && data.success) {
                    Utils.mostrarNotificacao('Cabeçalho recriado com sucesso!', 'success');
                    Historico.carregar();
                } else {
                    Utils.mostrarNotificacao('Erro ao recriar cabeçalho: ' + (data?.error || 'Erro desconhecido'), 'error');
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

// ===========================================
// HISTÓRICO - RECEBE TODOS OS DADOS DA PLANILHA
// ===========================================
const Historico = {
    carregar: function() {
        if (!GOOGLE_SHEETS_URL || GOOGLE_SHEETS_URL.includes('SUA_URL')) {
            const lista = document.getElementById('historico-lista');
            if (lista) {
                lista.innerHTML = '<tr><td colspan="14" style="text-align: center;">Configure a URL do Web App no código primeiro!</td></tr>';
            }
            return;
        }
        
        const lista = document.getElementById('historico-lista');
        if (lista) {
            lista.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 40px;"><div class="loading" style="border-top-color: #667eea;"></div> Carregando dados...</td></tr>';
        }
        
        fetch(GOOGLE_SHEETS_URL + '?action=carregarHistorico')
            .then(response => response.json())
            .then(data => {
                // Recebe TODOS os dados da planilha (68 colunas)
                historicoCompleto = data && Array.isArray(data) ? data : [];
                historicoFiltrado = [...historicoCompleto];
                paginaAtual = 1;
                this.renderizar();
                
                const ultimaSync = document.getElementById('ultima-sincronizacao');
                if (ultimaSync) ultimaSync.textContent = new Date().toLocaleTimeString('pt-BR');
                
                if (historicoCompleto.length > 0) {
                    Utils.mostrarNotificacao(`${historicoCompleto.length} registros carregados!`, 'success');
                }
            })
            .catch(error => {
                const lista = document.getElementById('historico-lista');
                if (lista) {
                    lista.innerHTML = '<tr><td colspan="14" style="text-align: center; color: #f56565;">Erro ao carregar: ' + error.message + '</td></tr>';
                }
                Utils.mostrarNotificacao('Erro ao carregar histórico: ' + error.message, 'error');
            });
    },
    
    renderizar: function() {
        const tbody = document.getElementById('historico-lista');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        const totalRegistros = document.getElementById('total-registros');
        if (totalRegistros) totalRegistros.textContent = historicoFiltrado.length;
        
        if (!historicoFiltrado || historicoFiltrado.length === 0) {
            tbody.innerHTML = '<tr><td colspan="14" style="text-align: center; padding: 40px;">Nenhum registro encontrado</td></tr>';
            this.renderizarPaginacao();
            return;
        }
        
        const inicio = (paginaAtual - 1) * itensPorPagina;
        const fim = Math.min(inicio + itensPorPagina, historicoFiltrado.length);
        const dadosPagina = historicoFiltrado.slice(inicio, fim);
        
        dadosPagina.forEach(item => {
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
            
            // Exibe os dados principais no histórico
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
                        <button class="btn-success" onclick="Historico.exportarPDFItem('${item.id}')" style="padding: 4px 8px;" title="Exportar PDF">📄</button>
                    </div>
                </td>
            `;
            
            // Armazena todos os dados no dataset para uso posterior
            row.dataset.detalhes = JSON.stringify(item);
        });
        
        this.renderizarPaginacao();
    },
    
    // Método para obter detalhes completos de um item
    getDetalhes: function(id) {
        return historicoCompleto.find(item => item.id === id) || null;
    },
    
    renderizarPaginacao: function() {
        const container = document.getElementById('paginacao-container');
        if (!container) return;
        
        const totalPaginas = Math.ceil(historicoFiltrado.length / itensPorPagina);
        
        if (totalPaginas <= 1) {
            container.innerHTML = '';
            return;
        }
        
        let html = '<div class="paginacao">';
        
        html += `<button class="btn-paginacao" onclick="Historico.mudarPagina(${paginaAtual - 1})" ${paginaAtual === 1 ? 'disabled' : ''}>◀ Anterior</button>`;
        
        const maxBotoes = 5;
        let inicio = Math.max(1, paginaAtual - Math.floor(maxBotoes / 2));
        let fim = Math.min(totalPaginas, inicio + maxBotoes - 1);
        
        if (fim - inicio + 1 < maxBotoes) {
            inicio = Math.max(1, fim - maxBotoes + 1);
        }
        
        if (inicio > 1) {
            html += `<button class="btn-paginacao" onclick="Historico.mudarPagina(1)">1</button>`;
            if (inicio > 2) html += `<span class="paginacao-ellipsis">...</span>`;
        }
        
        for (let i = inicio; i <= fim; i++) {
            html += `<button class="btn-paginacao ${i === paginaAtual ? 'active' : ''}" onclick="Historico.mudarPagina(${i})">${i}</button>`;
        }
        
        if (fim < totalPaginas) {
            if (fim < totalPaginas - 1) html += `<span class="paginacao-ellipsis">...</span>`;
            html += `<button class="btn-paginacao" onclick="Historico.mudarPagina(${totalPaginas})">${totalPaginas}</button>`;
        }
        
        html += `<button class="btn-paginacao" onclick="Historico.mudarPagina(${paginaAtual + 1})" ${paginaAtual === totalPaginas ? 'disabled' : ''}>Próximo ▶</button>`;
        
        html += `
            <select class="select-paginacao" onchange="Historico.mudarItensPorPagina(this.value)">
                <option value="10" ${itensPorPagina === 10 ? 'selected' : ''}>10 por página</option>
                <option value="20" ${itensPorPagina === 20 ? 'selected' : ''}>20 por página</option>
                <option value="50" ${itensPorPagina === 50 ? 'selected' : ''}>50 por página</option>
                <option value="100" ${itensPorPagina === 100 ? 'selected' : ''}>100 por página</option>
            </select>
        `;
        
        html += '</div>';
        
        const inicioRegistro = (paginaAtual - 1) * itensPorPagina + 1;
        const fimRegistro = Math.min(paginaAtual * itensPorPagina, historicoFiltrado.length);
        
        if (historicoFiltrado.length > 0) {
            html += `
                <div class="paginacao-info">
                    Mostrando ${inicioRegistro} - ${fimRegistro} de ${historicoFiltrado.length} registros
                </div>
            `;
        }
        
        container.innerHTML = html;
    },
    
    mudarPagina: function(novaPagina) {
        const totalPaginas = Math.ceil(historicoFiltrado.length / itensPorPagina);
        if (novaPagina < 1 || novaPagina > totalPaginas) return;
        
        paginaAtual = novaPagina;
        this.renderizar();
    },
    
    mudarItensPorPagina: function(novoValor) {
        itensPorPagina = parseInt(novoValor);
        paginaAtual = 1;
        this.renderizar();
    },
    
    filtrar: function(termo) {
        if (!termo || termo.trim() === '') {
            historicoFiltrado = [...historicoCompleto];
        } else {
            const termoLower = termo.toLowerCase().trim();
            historicoFiltrado = historicoCompleto.filter(item => {
                return (item.cliente && item.cliente.toLowerCase().includes(termoLower)) ||
                       (item.produto && item.produto.toLowerCase().includes(termoLower)) ||
                       (item.segmento && item.segmento.toLowerCase().includes(termoLower)) ||
                       (item.id && item.id.toLowerCase().includes(termoLower));
            });
        }
        
        paginaAtual = 1;
        this.renderizar();
    },
    
    filtrarPorStatus: function(status) {
        if (!status || status === '') {
            historicoFiltrado = [...historicoCompleto];
        } else {
            historicoFiltrado = historicoCompleto.filter(item => item.status === status);
        }
        
        paginaAtual = 1;
        this.renderizar();
    },
    
    limparVisualizacao: function() {
        if (confirm('Limpar visualização do histórico? Os dados no Google Sheets não serão afetados.')) {
            historicoFiltrado = [];
            historicoCompleto = [];
            paginaAtual = 1;
            this.renderizar();
            Utils.mostrarNotificacao('Visualização limpa', 'info');
        }
    },
    
    exportarCSV: function() {
        if (historicoFiltrado.length === 0) {
            Utils.mostrarNotificacao('Nenhum dado para exportar', 'warning');
            return;
        }
        
        let csv = 'ID,Data/Hora,Cliente,Segmento,Tipo,Risco,Produto,Modelo,Preço Alvo,Custo Total,Margem,Status\n';
        
        historicoFiltrado.forEach(item => {
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
    
    exportarPDF: function() {
        if (historicoFiltrado.length === 0) {
            Utils.mostrarNotificacao('Nenhum dado para exportar', 'warning');
            return;
        }
        
        let htmlContent = `
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Histórico de Simulações</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 20px; }
                    h1 { color: #2d3748; font-size: 24px; margin-bottom: 20px; }
                    table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 9px; }
                    th { background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 6px; }
                    td { border: 1px solid #e2e8f0; padding: 4px; }
                    .money { text-align: right; }
                    .percent { text-align: right; }
                    .footer { margin-top: 20px; font-size: 10px; color: #718096; text-align: right; }
                </style>
            </head>
            <body>
                <h1>📊 Histórico de Simulações - MFBD Precificação</h1>
                <p>Data de exportação: ${new Date().toLocaleString('pt-BR')}</p>
                <p>Total de registros: ${historicoFiltrado.length}</p>
                
                <table>
                    <thead>
                        <tr>
                            <th>ID</th>
                            <th>Data/Hora</th>
                            <th>Cliente</th>
                            <th>Segmento</th>
                            <th>Tipo</th>
                            <th>Risco</th>
                            <th>Produto</th>
                            <th>Modelo</th>
                            <th>Preço Alvo</th>
                            <th>Custo Total</th>
                            <th>Margem</th>
                            <th>Status</th>
                        </tr>
                    </thead>
                    <tbody>
        `;
        
        historicoFiltrado.forEach(item => {
            let dataFormatada = '---';
            if (item.data) {
                try {
                    const dataObj = new Date(item.data);
                    dataFormatada = dataObj.toLocaleDateString('pt-BR') + ' ' + 
                                   dataObj.toLocaleTimeString('pt-BR');
                } catch (e) {
                    dataFormatada = item.data;
                }
            }
            
            htmlContent += `
                <tr>
                    <td>${item.id ? item.id.substring(0, 8) + '...' : '---'}</td>
                    <td>${dataFormatada}</td>
                    <td>${item.cliente || '---'}</td>
                    <td>${item.segmento || '---'}</td>
                    <td>${item.tipo || '---'}</td>
                    <td>${item.risco || '---'}</td>
                    <td>${item.produto || '---'}</td>
                    <td>${item.modelo || '---'}</td>
                    <td class="money">${Utils.formatarMoeda(item.precoAlvo)}</td>
                    <td class="money">${Utils.formatarMoeda(item.custoTotal)}</td>
                    <td class="percent">${(item.margemLiquida || 0).toFixed(1)}%</td>
                    <td>${item.status || 'Pendente'}</td>
                </tr>
            `;
        });
        
        htmlContent += `
                    </tbody>
                </table>
                <div class="footer">
                    Gerado pelo MFBD Precificação Estratégica
                </div>
            </body>
            </html>
        `;
        
        const janelaPDF = window.open('', '_blank');
        if (janelaPDF) {
            janelaPDF.document.write(htmlContent);
            janelaPDF.document.close();
            janelaPDF.print();
        } else {
            Utils.mostrarNotificacao('Pop-up bloqueado! Permita pop-ups para exportar PDF.', 'error');
        }
    },
    
    exportarPDFItem: function(id) {
        const item = historicoCompleto.find(i => i.id === id);
        if (!item) {
            Utils.mostrarNotificacao('Item não encontrado', 'error');
            return;
        }
        
        fetch(GOOGLE_SHEETS_URL + `?action=carregarSimulacao&id=${id}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.success && data.dados) {
                    this.gerarPDFSimulacao(data.dados, item);
                } else {
                    Utils.mostrarNotificacao('Erro ao carregar dados completos', 'error');
                }
            })
            .catch(error => {
                Utils.mostrarNotificacao('Erro: ' + error.message, 'error');
            });
    },
    
    gerarPDFSimulacao: function(dados, itemResumido) {
        const sim = dados;
        
        let perfisParaPDF = [];
        if (sim.perfis && sim.perfis.length > 0) {
            perfisParaPDF = sim.perfis;
        } else if (sim.input && sim.input.perfis) {
            perfisParaPDF = sim.input.perfis;
        } else {
            perfisParaPDF = [{ nome: 'Pl', horas: 80 }, { nome: 'Jr', horas: 40 }];
        }
        
        let htmlContent = `
            <html>
            <head>
                <meta charset="UTF-8">
                <title>Simulação - ${sim.input?.cliente || 'Cliente'}</title>
                <style>
                    body { font-family: Arial, sans-serif; margin: 30px; }
                    .header { text-align: center; margin-bottom: 30px; }
                    .header h1 { color: #2d3748; font-size: 28px; margin-bottom: 5px; }
                    .header h2 { color: #667eea; font-size: 18px; font-weight: normal; }
                    .header .data { color: #718096; font-size: 12px; }
                    
                    .section { 
                        background: #f8fafc; 
                        border-radius: 10px; 
                        padding: 20px; 
                        margin-bottom: 20px;
                        border: 1px solid #e2e8f0;
                    }
                    .section-title { 
                        font-size: 18px; 
                        font-weight: 600; 
                        color: #2d3748; 
                        margin-bottom: 15px;
                        border-bottom: 2px solid #667eea;
                        padding-bottom: 5px;
                    }
                    
                    .grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; }
                    .grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 20px; }
                    
                    .info-row { display: flex; margin-bottom: 10px; }
                    .info-label { font-weight: 600; width: 150px; color: #4a5568; }
                    .info-value { flex: 1; color: #2d3748; }
                    
                    table { width: 100%; border-collapse: collapse; margin-top: 10px; }
                    th { background: #667eea; color: white; padding: 8px; text-align: left; }
                    td { padding: 8px; border-bottom: 1px solid #e2e8f0; }
                    
                    .price-box { 
                        text-align: center; 
                        padding: 15px; 
                        border-radius: 10px; 
                        border: 2px solid;
                    }
                    .price-box.piso { border-color: #ed8936; }
                    .price-box.alvo { border-color: #48bb78; }
                    .price-box.premium { border-color: #9f7aea; }
                    
                    .price-title { font-size: 12px; color: #718096; margin-bottom: 5px; }
                    .price-amount { font-size: 24px; font-weight: 800; color: #2d3748; }
                    
                    .footer { 
                        margin-top: 30px; 
                        text-align: center; 
                        color: #718096; 
                        font-size: 11px;
                        border-top: 1px solid #e2e8f0;
                        padding-top: 15px;
                    }
                </style>
            </head>
            <body>
                <div class="header">
                    <h1>📊 MFBD Precificação Estratégica</h1>
                    <h2>Simulação Comercial</h2>
                    <div class="data">Gerado em: ${new Date().toLocaleString('pt-BR')}</div>
                    <div class="data">ID: ${itemResumido.id}</div>
                </div>
                
                <div class="section">
                    <div class="section-title">📋 Dados do Cliente</div>
                    <div class="grid-2">
                        <div>
                            <div class="info-row"><span class="info-label">Cliente:</span> <span class="info-value">${sim.input?.cliente || '---'}</span></div>
                            <div class="info-row"><span class="info-label">Segmento:</span> <span class="info-value">${sim.input?.segmento || '---'}</span></div>
                            <div class="info-row"><span class="info-label">Tipo:</span> <span class="info-value">${sim.input?.tipo || '---'}</span></div>
                        </div>
                        <div>
                            <div class="info-row"><span class="info-label">Risco:</span> <span class="info-value">${sim.input?.risco || '---'}</span></div>
                            <div class="info-row"><span class="info-label">Produto:</span> <span class="info-value">${sim.input?.produto || '---'}</span></div>
                            <div class="info-row"><span class="info-label">Modelo:</span> <span class="info-value">${sim.input?.modeloCobranca || '---'}</span></div>
                        </div>
                    </div>
                    <div class="info-row"><span class="info-label">Escopo:</span> <span class="info-value">${sim.input?.escopo || '---'}</span></div>
                </div>
                
                <div class="section">
                    <div class="section-title">💰 Preços Sugeridos</div>
                    <div class="grid-3">
                        <div class="price-box piso">
                            <div class="price-title">PREÇO PISO</div>
                            <div class="price-amount">${Utils.formatarMoeda(itemResumido.precoAlvo * 0.8)}</div>
                            <div style="font-size: 11px;">Margem: 40%</div>
                        </div>
                        <div class="price-box alvo">
                            <div class="price-title">PREÇO ALVO</div>
                            <div class="price-amount">${Utils.formatarMoeda(itemResumido.precoAlvo)}</div>
                            <div style="font-size: 11px;">Margem: 55%</div>
                        </div>
                        <div class="price-box premium">
                            <div class="price-title">PREÇO PREMIUM</div>
                            <div class="price-amount">${Utils.formatarMoeda(itemResumido.precoAlvo * 1.2)}</div>
                            <div style="font-size: 11px;">Margem: 65%</div>
                        </div>
                    </div>
                </div>
                
                <div class="grid-2">
                    <div class="section">
                        <div class="section-title">📊 Composição de Custos</div>
                        <table>
                            <tr><th>Perfil</th><th>Horas</th><th>Custo/Hora</th><th>Total</th></tr>
        `;
        
        perfisParaPDF.forEach(p => {
            const custoHora = p.custoHora || (p.nome === 'Pl' ? 73.33 : 53.33);
            const custoTotal = (p.horas || 0) * custoHora;
            htmlContent += `<tr><td>${p.nome}</td><td>${p.horas || 0}h</td><td>${Utils.formatarMoeda(custoHora)}</td><td>${Utils.formatarMoeda(custoTotal)}</td></tr>`;
        });
        
        htmlContent += `
                        </table>
                        <div style="margin-top: 15px;">
                            <div class="info-row"><span class="info-label">Custo Direto:</span> <span class="info-value">${Utils.formatarMoeda(itemResumido.custoTotal * 0.7)}</span></div>
                            <div class="info-row"><span class="info-label">Overhead:</span> <span class="info-value">${Utils.formatarMoeda(itemResumido.custoTotal * 0.3)}</span></div>
                            <div class="info-row"><span class="info-label" style="font-weight: 800;">CUSTO TOTAL:</span> <span class="info-value" style="font-weight: 800;">${Utils.formatarMoeda(itemResumido.custoTotal)}</span></div>
                        </div>
                    </div>
                    
                    <div class="section">
                        <div class="section-title">💳 Condições Comerciais</div>
                        <div class="info-row"><span class="info-label">Entrada:</span> <span class="info-value">${sim.input?.entrada || 30}%</span></div>
                        <div class="info-row"><span class="info-label">Parcelas:</span> <span class="info-value">${sim.input?.parcelas || 6}x</span></div>
                        <div class="info-row"><span class="info-label">Desconto:</span> <span class="info-value">${sim.input?.desconto || 0}%</span></div>
                        <div class="info-row"><span class="info-label">Parceiro:</span> <span class="info-value">${sim.input?.temParceiro === 'sim' ? sim.input.percentualParceiro + '%' : 'Não'}</span></div>
                        <div class="info-row"><span class="info-label">CS:</span> <span class="info-value">${sim.input?.aplicaCS === 'sim' ? sim.input.percentualCS + '%' : 'Não'}</span></div>
                    </div>
                </div>
                
                <div class="section">
                    <div class="section-title">📈 Análise de Margem</div>
                    <div class="grid-2">
                        <div>
                            <div class="info-row"><span class="info-label">Receita Bruta:</span> <span class="info-value">${Utils.formatarMoeda(itemResumido.precoAlvo)}</span></div>
                            <div class="info-row"><span class="info-label">Impostos:</span> <span class="info-value">${Utils.formatarMoeda(itemResumido.precoAlvo * 0.06)}</span></div>
                            <div class="info-row"><span class="info-label">CS:</span> <span class="info-value">${Utils.formatarMoeda(itemResumido.precoAlvo * 0.075)}</span></div>
                            <div class="info-row"><span class="info-label">Receita Líquida:</span> <span class="info-value">${Utils.formatarMoeda(itemResumido.precoAlvo * 0.865)}</span></div>
                        </div>
                        <div>
                            <div class="info-row"><span class="info-label">Custo Total:</span> <span class="info-value">${Utils.formatarMoeda(itemResumido.custoTotal)}</span></div>
                            <div class="info-row"><span class="info-label">Margem Líquida (R$):</span> <span class="info-value">${Utils.formatarMoeda(itemResumido.precoAlvo * 0.865 - itemResumido.custoTotal)}</span></div>
                            <div class="info-row"><span class="info-label">Margem Líquida (%):</span> <span class="info-value">${(itemResumido.margemLiquida || 0).toFixed(1)}%</span></div>
                        </div>
                    </div>
                </div>
                
                <div class="footer">
                    <p>Este é um documento gerado automaticamente pelo sistema MFBD Precificação Estratégica</p>
                    <p>ID da Simulação: ${itemResumido.id} | Data: ${itemResumido.data ? new Date(itemResumido.data).toLocaleString('pt-BR') : '---'}</p>
                </div>
            </body>
            </html>
        `;
        
        const janelaPDF = window.open('', '_blank');
        if (janelaPDF) {
            janelaPDF.document.write(htmlContent);
            janelaPDF.document.close();
            janelaPDF.print();
        } else {
            Utils.mostrarNotificacao('Pop-up bloqueado! Permita pop-ups para exportar PDF.', 'error');
        }
    },
    
    editar: function(id) {
        if (!confirm('Carregar esta simulação para edição?')) return;
        
        fetch(GOOGLE_SHEETS_URL + `?action=carregarSimulacao&id=${id}`)
            .then(response => response.json())
            .then(data => {
                if (data && data.success && data.dados) {
                    const sim = data.dados;
                    
                    editandoId = id;
                    const badge = document.getElementById('editModeBadge');
                    if (badge) badge.classList.add('active');
                    const btnCancelar = document.getElementById('btnCancelar');
                    if (btnCancelar) btnCancelar.style.display = 'inline-flex';
                    
                    document.getElementById('cliente_nome').value = sim.input?.cliente || '';
                    document.getElementById('segmento').value = sim.input?.segmento || '';
                    document.getElementById('tipo_cliente').value = sim.input?.tipo || 'Novo';
                    document.getElementById('risco_inadimplencia').value = sim.input?.risco || 'Médio';
                    document.getElementById('produto').value = sim.input?.produto || 'Consultoria Estratégica';
                    document.getElementById('escopo').value = sim.input?.escopo || '';
                    document.getElementById('complexidade').value = sim.input?.complexidade || 'Média';
                    document.getElementById('urgencia').value = sim.input?.urgencia || 'Normal';
                    
                    document.querySelectorAll('input[name="modelo_cobranca"]').forEach(radio => {
                        if (radio.value === sim.input?.modeloCobranca) {
                            radio.checked = true;
                        }
                    });
                    
                    document.getElementById('entrada').value = sim.input?.entrada || 30;
                    document.getElementById('parcelas').value = sim.input?.parcelas || 6;
                    document.getElementById('desconto').value = sim.input?.desconto || 0;
                    document.getElementById('tem_parceiro').value = sim.input?.temParceiro || 'nao';
                    
                    if (sim.input?.temParceiro === 'sim') {
                        document.getElementById('parceiro-group').style.display = 'block';
                        document.getElementById('percentual_parceiro').value = sim.input?.percentualParceiro || 10;
                    } else {
                        document.getElementById('parceiro-group').style.display = 'none';
                    }
                    
                    document.getElementById('aplica_cs').value = sim.input?.aplicaCS || 'sim';
                    
                    if (sim.input?.aplicaCS === 'sim') {
                        document.getElementById('cs-group').style.display = 'block';
                        document.getElementById('percentual_cs').value = sim.input?.percentualCS || 7.5;
                    } else {
                        document.getElementById('cs-group').style.display = 'none';
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
                                    <input type="number" class="perfil-horas" placeholder="Horas" value="${perfil.horas || 40}" min="0" step="1">
                                    <input type="text" class="perfil-buffer" placeholder="Buffer %" readonly value="20%">
                                    <button type="button" class="btn-danger" onclick="Perfis.remover(this)" style="padding: 12px;">🗑️</button>
                                `;
                                container.appendChild(newRow);
                            });
                        } else {
                            const row1 = document.createElement('div');
                            row1.className = 'perfil-row';
                            row1.innerHTML = `
                                <select class="perfil-nome"><option value="Pl" selected>Pl</option></select>
                                <input type="number" class="perfil-horas" value="80" min="0" step="1">
                                <input type="text" class="perfil-buffer" readonly value="20%">
                                <button type="button" class="btn-danger" onclick="Perfis.remover(this)">🗑️</button>
                            `;
                            container.appendChild(row1);
                            
                            const row2 = document.createElement('div');
                            row2.className = 'perfil-row';
                            row2.innerHTML = `
                                <select class="perfil-nome"><option value="Jr" selected>Jr</option></select>
                                <input type="number" class="perfil-horas" value="40" min="0" step="1">
                                <input type="text" class="perfil-buffer" readonly value="20%">
                                <button type="button" class="btn-danger" onclick="Perfis.remover(this)">🗑️</button>
                            `;
                            container.appendChild(row2);
                        }
                    }
                    
                    Perfis.atualizarBuffer();
                    Calculadora.calcular();
                    
                    Utils.mostrarNotificacao('Simulação carregada para edição!', 'success');
                    const inputTab = document.querySelectorAll('.tab-btn')[0];
                    if (inputTab) {
                        UI.showTab('input', inputTab);
                    }
                    
                } else {
                    Utils.mostrarNotificacao('Erro ao carregar: ' + (data?.error || 'Erro desconhecido'), 'error');
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
                if (data && data.success) {
                    Utils.mostrarNotificacao('Simulação excluída!', 'success');
                    this.carregar();
                } else {
                    Utils.mostrarNotificacao('Erro ao excluir: ' + (data?.error || 'Erro desconhecido'), 'error');
                }
            })
            .catch(error => {
                Utils.mostrarNotificacao('Erro ao excluir: ' + error.message, 'error');
            });
    },
    
    alterarStatus: function(id, elemento) {
        if (!elemento) return;
        
        const statusAtual = elemento.textContent.trim();
        const opcoes = ['Pendente', 'Ganho', 'Perdido'];
        const proximoIndex = (opcoes.indexOf(statusAtual) + 1) % opcoes.length;
        const novoStatus = opcoes[proximoIndex];
        
        if (confirm(`Alterar status para "${novoStatus}"?`)) {
            elemento.textContent = novoStatus;
            elemento.className = `status-badge status-${novoStatus.toLowerCase()}`;
            Utils.mostrarNotificacao(`Status alterado para ${novoStatus}`, 'success');
            
            fetch(GOOGLE_SHEETS_URL, {
                method: 'POST',
                mode: 'no-cors',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    action: 'atualizarStatus',
                    id: id,
                    status: novoStatus
                })
            });
        }
    }
};

// ===========================================
// EDIÇÃO
// ===========================================
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
        if (valor === undefined || valor === null || valor === '') return padrao;
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
        const notificacoesExistentes = document.querySelectorAll('.notification');
        notificacoesExistentes.forEach(n => n.remove());
        
        const notification = document.createElement('div');
        notification.className = `notification ${tipo}`;
        notification.textContent = mensagem;
        document.body.appendChild(notification);
        
        setTimeout(() => {
            if (notification.parentNode) {
                notification.remove();
            }
        }, 5000);
    },
    
    delay: function(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    },
    
    atualizarContadorAutoSave: function() {
        const contador = document.getElementById('contadorAutoSave');
        if (contador) {
            if (syncTimeout) {
                const segundosRestantes = Math.ceil(syncTimeout._idleTimeout / 1000) || 3;
                contador.textContent = `⏳ Auto-save em ${segundosRestantes}s`;
            } else {
                contador.textContent = '';
            }
        }
    }
};

// ===========================================
// INICIALIZAÇÃO
// ===========================================
document.addEventListener('DOMContentLoaded', function() {
    window.Login = Login;
    window.UI = UI;
    window.Perfis = Perfis;
    window.Calculadora = Calculadora;
    window.Sincronizacao = Sincronizacao;
    window.Historico = Historico;
    window.Edicao = Edicao;
    window.Tabelas = Tabelas;
    
    if (!Login.verificarSessao()) {
        const loginContainer = document.getElementById('loginContainer');
        const mainContent = document.getElementById('mainContent');
        
        if (loginContainer) loginContainer.style.display = 'flex';
        if (mainContent) mainContent.classList.remove('active');
        
        const loginEmail = document.getElementById('loginEmail');
        const loginSenha = document.getElementById('loginSenha');
        
        if (loginEmail) {
            loginEmail.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') Login.entrar();
            });
        }
        
        if (loginSenha) {
            loginSenha.addEventListener('keypress', function(e) {
                if (e.key === 'Enter') Login.entrar();
            });
        }
    }
});