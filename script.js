// ========== SISTEMA DE LOGIN MFBD ==========
// Autenticação via Google Sheets - VERSÃO COMPLETA
// ============================================

// Estado da autenticação
let usuarioAtual = null;
let tentativasLogin = 0;

// ========== FUNÇÕES DE FORMATAÇÃO BRASILEIRA ==========
function formatarMoeda(valor) {
    if (valor === undefined || valor === null || isNaN(valor)) return 'R$ 0,00';
    // Garantir que valor é número
    const num = parseFloat(valor);
    if (isNaN(num)) return 'R$ 0,00';
    return num.toLocaleString('pt-BR', {
        style: 'currency',
        currency: 'BRL',
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
}

function formatarNumero(valor, casas = 2) {
    if (valor === undefined || valor === null || isNaN(valor)) return '0,00';
    const num = parseFloat(valor);
    if (isNaN(num)) return '0,00';
    return num.toLocaleString('pt-BR', {
        minimumFractionDigits: casas,
        maximumFractionDigits: casas
    });
}

function formatarPercentual(valor) {
    if (valor === undefined || valor === null || isNaN(valor)) return '0%';
    const num = parseFloat(valor);
    if (isNaN(num)) return '0%';
    // Converter de decimal para percentual (0.35 -> 35,0%)
    const percentual = num * 100;
    return percentual.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }) + '%';
}

// Verificar se usuário já está logado
function verificarSessao() {
    console.log('🔍 Verificando sessão...');
    const sessao = localStorage.getItem('mfbd_sessao');
    
    if (sessao) {
        try {
            usuarioAtual = JSON.parse(sessao);
            console.log('✅ Sessão restaurada:', usuarioAtual.email);
            mostrarSistema();
            atualizarHeaderUsuario();
        } catch (e) {
            console.error('❌ Erro ao restaurar sessão:', e);
            fazerLogout();
        }
    } else {
        console.log('🔐 Nenhuma sessão ativa');
        mostrarTelaLogin();
    }
}

// Mostrar tela de login
function mostrarTelaLogin() {
    const telaLogin = document.getElementById('tela-login');
    const sistemaPrincipal = document.getElementById('sistema-principal');
    
    if (telaLogin) telaLogin.style.display = 'flex';
    if (sistemaPrincipal) sistemaPrincipal.style.display = 'none';
}

// Mostrar sistema principal
function mostrarSistema() {
    const telaLogin = document.getElementById('tela-login');
    const sistemaPrincipal = document.getElementById('sistema-principal');
    
    if (telaLogin) telaLogin.style.display = 'none';
    if (sistemaPrincipal) sistemaPrincipal.style.display = 'block';
    
    // Inicializar componentes do sistema
    setTimeout(() => {
        if (typeof adicionarPerfil === 'function') adicionarPerfil();
        if (typeof atualizarTodosCustos === 'function') atualizarTodosCustos();
        if (typeof atualizarHistorico === 'function') atualizarHistorico();
    }, 100);
}

// Atualizar header com nome do usuário
function atualizarHeaderUsuario() {
    if (!usuarioAtual) return;
    
    const header = document.querySelector('.header');
    if (!header) return;
    
    // Remover info antiga se existir
    const oldUserInfo = document.getElementById('user-info-header');
    if (oldUserInfo) oldUserInfo.innerHTML = '';
    
    // Criar nova info
    const userInfo = document.getElementById('user-info-header');
    if (!userInfo) return;
    
    // Determinar cor do perfil
    let perfilColor = '#3b82f6'; // Azul padrão
    let perfilIcon = '👤';
    
    if (usuarioAtual.perfil === 'Admin') {
        perfilColor = '#10b981'; // Verde
        perfilIcon = '👑';
    }
    if (usuarioAtual.perfil === 'Master') {
        perfilColor = '#8b5cf6'; // Roxo
        perfilIcon = '⚡';
    }
    
    userInfo.innerHTML = `
        <div style="display: flex; justify-content: flex-end; margin-top: 10px;">
            <span style="background: ${perfilColor}; padding: 8px 20px; border-radius: 30px; font-size: 14px; display: inline-flex; align-items: center; gap: 10px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); color: white;">
                <span style="display: flex; align-items: center; gap: 5px;">
                    <span style="font-size: 18px;">${perfilIcon}</span>
                    <strong>${usuarioAtual.nome || usuarioAtual.email}</strong>
                    <span style="background: rgba(255,255,255,0.2); padding: 2px 8px; border-radius: 20px; font-size: 11px; margin-left: 5px;">
                        ${usuarioAtual.perfil || 'Usuário'}
                    </span>
                </span>
                <button onclick="fazerLogout()" style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 20px; cursor: pointer; font-size: 13px; display: flex; align-items: center; gap: 5px; transition: all 0.2s;">
                    <span>🚪</span> Sair
                </button>
            </span>
        </div>
    `;
}

// Função de login
async function fazerLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const btnLogin = document.querySelector('.btn-login');
    const erroElement = document.getElementById('login-erro');
    const loadingElement = document.getElementById('login-loading');
    
    // Validações básicas
    if (!email || !senha) {
        mostrarErro('⚠️ Preencha email e senha');
        return;
    }
    
    if (!email.includes('@') || !email.includes('.')) {
        mostrarErro('⚠️ Email inválido');
        return;
    }
    
    if (senha.length < 3) {
        mostrarErro('⚠️ Senha deve ter pelo menos 3 caracteres');
        return;
    }
    
    // Limitar tentativas
    tentativasLogin++;
    if (tentativasLogin > 3) {
        mostrarErro('⏰ Muitas tentativas. Aguarde 30 segundos...');
        btnLogin.disabled = true;
        setTimeout(() => {
            tentativasLogin = 0;
            btnLogin.disabled = false;
            btnLogin.innerHTML = '🔐 Entrar no Sistema';
        }, 30000);
        return;
    }
    
    // Mostrar loading
    btnLogin.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; border-color: rgba(255,255,255,0.3); border-top-color: white;"></span> Verificando...';
    btnLogin.disabled = true;
    if (erroElement) erroElement.style.display = 'none';
    if (loadingElement) loadingElement.style.display = 'flex';
    
    try {
        console.log('🔐 Tentando login:', email);
        
        // Tentar login primeiro com usuário de teste
        if (email === 'admin@mfbd.com' && senha === '123456') {
            console.log('✅ Login de teste bem-sucedido');
            
            usuarioAtual = {
                email: email,
                nome: 'Administrador',
                perfil: 'Admin'
            };
            
            localStorage.setItem('mfbd_sessao', JSON.stringify(usuarioAtual));
            mostrarToast('✅ Login realizado com sucesso!', 'success');
            
            setTimeout(() => {
                if (loadingElement) loadingElement.style.display = 'none';
                mostrarSistema();
                atualizarHeaderUsuario();
            }, 1000);
            
            return;
        }
        
        // Tentar login com Google Sheets
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'verificarLogin',
                email: email,
                senha: senha
            })
        });
        
        const data = await response.json();
        console.log('📥 Resposta do servidor:', data);
        
        if (data && data.status === 'sucesso') {
            // Login bem-sucedido
            usuarioAtual = data.usuario || {
                email: email,
                nome: email.split('@')[0],
                perfil: 'Usuário'
            };
            
            // Salvar sessão
            localStorage.setItem('mfbd_sessao', JSON.stringify(usuarioAtual));
            
            mostrarToast('✅ Login realizado com sucesso!', 'success');
            
            // Resetar tentativas
            tentativasLogin = 0;
            
            // Mostrar sistema
            setTimeout(() => {
                if (loadingElement) loadingElement.style.display = 'none';
                mostrarSistema();
                atualizarHeaderUsuario();
            }, 1000);
            
        } else {
            // Login falhou
            const mensagem = data?.mensagem || '❌ Email ou senha inválidos';
            mostrarErro(mensagem);
            
            btnLogin.innerHTML = '🔐 Entrar no Sistema';
            btnLogin.disabled = false;
            if (loadingElement) loadingElement.style.display = 'none';
        }
        
    } catch (error) {
        console.error('❌ Erro no login:', error);
        mostrarErro('❌ Erro ao conectar com servidor. Tente novamente.');
        btnLogin.innerHTML = '🔐 Entrar no Sistema';
        btnLogin.disabled = false;
        if (loadingElement) loadingElement.style.display = 'none';
    }
}

// Mostrar mensagem de erro
function mostrarErro(mensagem) {
    const erroElement = document.getElementById('login-erro');
    if (erroElement) {
        erroElement.textContent = mensagem;
        erroElement.style.display = 'block';
        
        // Esconder após 5 segundos
        setTimeout(() => {
            erroElement.style.display = 'none';
        }, 5000);
    }
}

// Toggle mostrar senha
function toggleSenha() {
    const senhaInput = document.getElementById('login-senha');
    const toggleBtn = document.querySelector('.toggle-senha');
    
    if (!senhaInput || !toggleBtn) return;
    
    if (senhaInput.type === 'password') {
        senhaInput.type = 'text';
        toggleBtn.textContent = '🙈';
        toggleBtn.title = 'Ocultar senha';
    } else {
        senhaInput.type = 'password';
        toggleBtn.textContent = '👁️';
        toggleBtn.title = 'Mostrar senha';
    }
}

// Logout
function fazerLogout() {
    localStorage.removeItem('mfbd_sessao');
    usuarioAtual = null;
    
    // Limpar header
    const userInfo = document.getElementById('user-info-header');
    if (userInfo) userInfo.innerHTML = '';
    
    mostrarTelaLogin();
    
    // Limpar campos
    const emailInput = document.getElementById('login-email');
    const senhaInput = document.getElementById('login-senha');
    const erroElement = document.getElementById('login-erro');
    const loadingElement = document.getElementById('login-loading');
    
    if (emailInput) emailInput.value = '';
    if (senhaInput) senhaInput.value = '';
    if (erroElement) erroElement.style.display = 'none';
    if (loadingElement) loadingElement.style.display = 'none';
    
    // Resetar botão
    const btnLogin = document.querySelector('.btn-login');
    if (btnLogin) {
        btnLogin.innerHTML = '🔐 Entrar no Sistema';
        btnLogin.disabled = false;
    }
    
    mostrarToast('👋 Logout realizado', 'success');
}

// Verificar tecla Enter nos campos de login
document.addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        const telaLogin = document.getElementById('tela-login');
        if (telaLogin && telaLogin.style.display === 'flex') {
            fazerLogin(e);
        }
    }
});

// ========== SISTEMA DE PRECIFICAÇÃO MFBD ==========
// Versão 5.0 - Com exclusão/edição em TODAS as abas via Google Sheets
// ==================================================

let historico = JSON.parse(localStorage.getItem('historicoSmartPrice') || '[]');
let indiceEditando = -1;

// ========== CONFIGURAÇÃO GOOGLE SHEETS ==========
// SUBSTITUA ESTA URL PELA SUA URL DO GOOGLE APPS SCRIPT
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbwQcekRNWdeWx34ATvu4Q161pzaU2GqNRGPs_-d0IUCIwMq9ZH4jhPyczfGuOjgJefq/exec';

// ========== FUNÇÕES DE NOTIFICAÇÃO ==========
function mostrarToast(mensagem, tipo = 'success') {
    const toast = document.createElement('div');
    toast.className = `toast ${tipo}`;
    toast.innerHTML = `
        <span style="font-size: 20px;">${tipo === 'success' ? '✅' : tipo === 'error' ? '❌' : '⚠️'}</span>
        <span>${mensagem}</span>
    `;
    document.body.appendChild(toast);
    
    setTimeout(() => {
        toast.style.animation = 'slideIn 0.3s reverse';
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}

// ========== FUNÇÕES DE UTILIDADE ==========
function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'historico') {
        atualizarHistorico();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function fecharModal() {
    document.getElementById('modalEdicao').classList.remove('active');
}

// ========== GERENCIAMENTO DE PERFIS ==========
function adicionarPerfil() {
    const container = document.getElementById('perfis-container');
    const div = document.createElement('div');
    div.className = 'perfil-row';
    div.innerHTML = `
        <select class="perfil">
            <option value="estag">Estagiário</option>
            <option value="jr">Júnior</option>
            <option value="pl">Pleno</option>
            <option value="sr">Sênior</option>
            <option value="coord">Coordenador</option>
            <option value="socio">Sócio</option>
        </select>
        <input type="number" class="horas" value="40" min="0" step="1" placeholder="Horas">
        <span class="custo-previsto">R$ 0,00</span>
        <button class="remove-btn" onclick="removerPerfil(this)">✕</button>
    `;
    container.appendChild(div);
    atualizarCustoPrevisto(div);
    
    div.querySelector('.horas').addEventListener('input', () => atualizarCustoPrevisto(div));
    div.querySelector('.perfil').addEventListener('change', () => atualizarCustoPrevisto(div));
}

function removerPerfil(botao) {
    if (document.querySelectorAll('.perfil-row').length > 1) {
        botao.parentElement.remove();
    } else {
        mostrarToast('Mantenha pelo menos um perfil na equipe', 'warning');
    }
}

// ========== CÁLCULO DE CUSTOS ==========
function getCustoHora(perfil) {
    const salario = parseFloat(document.getElementById(`salario${perfil}`)?.value) || 0;
    const beneficios = parseFloat(document.getElementById(`beneficios${perfil}`)?.value) || 0;
    const horas = parseFloat(document.getElementById(`horas${perfil}`)?.value) || 140;
    
    const encargos = salario * 0.72;
    const custoTotalMensal = salario + encargos + beneficios;
    
    const overheadTotal = parseFloat(document.getElementById('overheadTotal')?.value) || 45000;
    const horasTotais = parseFloat(document.getElementById('horasTotais')?.value) || 840;
    const overheadHora = overheadTotal / horasTotais;
    
    return (custoTotalMensal / horas) + overheadHora;
}

function atualizarCustoPrevisto(div) {
    const select = div.querySelector('.perfil');
    const horas = parseFloat(div.querySelector('.horas').value) || 0;
    const perfil = select.value;
    
    const perfilId = perfil.charAt(0).toUpperCase() + perfil.slice(1);
    const custoHora = getCustoHora(perfilId);
    const custoTotal = custoHora * horas;
    
    div.querySelector('.custo-previsto').textContent = formatarMoeda(custoTotal);
}

function calcularBuffer() {
    const complexidade = document.getElementById('complexidade').value;
    const urgencia = document.getElementById('urgencia').value;
    
    const bufferComplexidade = {
        baixa: parseFloat(document.getElementById('bufferBaixa')?.value) || 10,
        media: parseFloat(document.getElementById('bufferMedia')?.value) || 20,
        alta: parseFloat(document.getElementById('bufferAlta')?.value) || 30
    };
    
    const bufferUrgencia = {
        normal: parseFloat(document.getElementById('bufferNormal')?.value) || 0,
        urgente: parseFloat(document.getElementById('bufferUrgencia')?.value) || 20
    };
    
    return (bufferComplexidade[complexidade] + bufferUrgencia[urgencia]) / 100;
}

// ========== COLETA E PREENCHIMENTO DE DADOS ==========
function coletarDadosInput() {
    const perfis = document.querySelectorAll('.perfil-row');
    const perfisData = [];
    
    perfis.forEach(perfil => {
        const select = perfil.querySelector('.perfil');
        const horas = parseFloat(perfil.querySelector('.horas').value) || 0;
        
        if (horas > 0) {
            perfisData.push({
                perfil: select.value,
                perfilNome: select.options[select.selectedIndex].text,
                horas: horas,
                custoHora: getCustoHora(select.value.charAt(0).toUpperCase() + select.value.slice(1))
            });
        }
    });

    return {
        cliente: document.getElementById('cliente').value,
        segmento: document.getElementById('segmento').value,
        tipo: document.getElementById('tipo').value,
        risco: document.getElementById('risco').value,
        produto: document.getElementById('produto').value,
        produtoTexto: document.getElementById('produto').options[document.getElementById('produto').selectedIndex].text,
        escopo: document.getElementById('escopo').value,
        complexidade: document.getElementById('complexidade').value,
        urgencia: document.getElementById('urgencia').value,
        cobranca: document.querySelector('input[name="cobranca"]:checked')?.value || 'hora',
        cobrancaTexto: document.querySelector('input[name="cobranca"]:checked')?.nextSibling?.nodeValue?.trim() || 'Hora',
        perfis: perfisData,
        riscoEscopo: parseFloat(document.getElementById('riscoEscopo').value) || 20,
        entrada: parseFloat(document.getElementById('entrada').value) || 50,
        parcelas: parseInt(document.getElementById('parcelas').value) || 1,
        desconto: parseFloat(document.getElementById('desconto').value) || 0,
        parceiro: document.getElementById('parceiro').value,
        percParceiro: parseFloat(document.getElementById('percParceiro').value) || 0,
        aplicaCS: document.getElementById('aplicaCS').value,
        percCS: parseFloat(document.getElementById('percCS').value) || 7.5
    };
}

function preencherInputComDados(dados) {
    document.getElementById('cliente').value = dados.cliente || '';
    document.getElementById('segmento').value = dados.segmento || 'tecnologia';
    document.getElementById('tipo').value = dados.tipo || 'novo';
    document.getElementById('risco').value = dados.risco || 'baixo';
    document.getElementById('produto').value = dados.produto || 'consultoria';
    document.getElementById('escopo').value = dados.escopo || '';
    document.getElementById('complexidade').value = dados.complexidade || 'media';
    document.getElementById('urgencia').value = dados.urgencia || 'normal';
    
    const radios = document.getElementsByName('cobranca');
    radios.forEach(radio => {
        if (radio.value === dados.cobranca) {
            radio.checked = true;
            radio.closest('.radio-option').classList.add('selected');
        } else {
            radio.closest('.radio-option').classList.remove('selected');
        }
    });
    
    document.getElementById('riscoEscopo').value = dados.riscoEscopo || 20;
    document.getElementById('entrada').value = dados.entrada || 50;
    document.getElementById('parcelas').value = dados.parcelas || 1;
    document.getElementById('desconto').value = dados.desconto || 0;
    document.getElementById('parceiro').value = dados.parceiro || 'nao';
    document.getElementById('percParceiro').value = dados.percParceiro || 0;
    document.getElementById('aplicaCS').value = dados.aplicaCS || 'sim';
    document.getElementById('percCS').value = dados.percCS || 7.5;
    
    const container = document.getElementById('perfis-container');
    container.innerHTML = '';
    
    if (dados.perfis && dados.perfis.length > 0) {
        dados.perfis.forEach(p => {
            const div = document.createElement('div');
            div.className = 'perfil-row';
            div.innerHTML = `
                <select class="perfil">
                    <option value="estag" ${p.perfil === 'estag' ? 'selected' : ''}>Estagiário</option>
                    <option value="jr" ${p.perfil === 'jr' ? 'selected' : ''}>Júnior</option>
                    <option value="pl" ${p.perfil === 'pl' ? 'selected' : ''}>Pleno</option>
                    <option value="sr" ${p.perfil === 'sr' ? 'selected' : ''}>Sênior</option>
                    <option value="coord" ${p.perfil === 'coord' ? 'selected' : ''}>Coordenador</option>
                    <option value="socio" ${p.perfil === 'socio' ? 'selected' : ''}>Sócio</option>
                </select>
                <input type="number" class="horas" value="${p.horas}" min="0" step="1" placeholder="Horas">
                <span class="custo-previsto">R$ 0,00</span>
                <button class="remove-btn" onclick="removerPerfil(this)">✕</button>
            `;
            container.appendChild(div);
            
            div.querySelector('.horas').addEventListener('input', () => atualizarCustoPrevisto(div));
            div.querySelector('.perfil').addEventListener('change', () => atualizarCustoPrevisto(div));
            atualizarCustoPrevisto(div);
        });
    } else {
        adicionarPerfil();
    }
}

// ========== FUNÇÃO PRINCIPAL DE CÁLCULO ==========
function calcular() {
    try {
        const perfis = document.querySelectorAll('.perfil-row');
        let custoTotal = 0;
        let detalhamento = [];
        
        perfis.forEach(perfil => {
            const select = perfil.querySelector('.perfil');
            const horas = parseFloat(perfil.querySelector('.horas').value) || 0;
            
            if (horas > 0) {
                const perfilNome = select.options[select.selectedIndex].text;
                const perfilValue = select.value;
                const perfilId = perfilValue.charAt(0).toUpperCase() + perfilValue.slice(1);
                const custoHora = getCustoHora(perfilId);
                const custo = custoHora * horas;
                
                custoTotal += custo;
                detalhamento.push({ perfil: perfilNome, horas, custoHora, custo });
            }
        });

        const buffer = calcularBuffer();
        const custoComBuffer = custoTotal * (1 + buffer);
        const overheadTotal = parseFloat(document.getElementById('overheadTotal')?.value) || 45000;

        const percImpostos = parseFloat(document.getElementById('impostos')?.value) || 11.33;
        const impostos = custoComBuffer * (percImpostos / 100);

        const aplicaCS = document.getElementById('aplicaCS')?.value === 'sim';
        const percCS = aplicaCS ? (parseFloat(document.getElementById('percCS')?.value) || 7.5) : 0;
        const cs = custoComBuffer * (percCS / 100);

        const temParceiro = document.getElementById('parceiro')?.value === 'sim';
        const percParceiro = temParceiro ? (parseFloat(document.getElementById('percParceiro')?.value) || 0) : 0;
        const parceiro = custoComBuffer * (percParceiro / 100);

        const tipoCobranca = document.querySelector('input[name="cobranca"]:checked')?.value || 'hora';
        const margens = {
            hora: parseFloat(document.getElementById('margemHora')?.value) || 55,
            fechado: parseFloat(document.getElementById('margemFechado')?.value) || 47,
            retainer: parseFloat(document.getElementById('margemRetainer')?.value) || 52,
            exito: parseFloat(document.getElementById('margemExito')?.value) || 65,
            hibrido: parseFloat(document.getElementById('margemHibrido')?.value) || 50
        };
        
        const margemAlvo = margens[tipoCobranca] / 100;
        const custoBase = custoComBuffer + impostos + cs + parceiro;

        const precoPiso = custoBase * (1 + (margemAlvo - 0.15));
        const precoAlvo = custoBase * (1 + margemAlvo);
        const precoPremium = custoBase * (1 + margemAlvo + 0.15);
        const desconto = parseFloat(document.getElementById('desconto').value) || 0;
        const precoComDesconto = precoAlvo * (1 - desconto/100);

        // Atualizar UI com formatação brasileira
        document.getElementById('preco-piso').innerHTML = formatarMoeda(precoPiso);
        document.getElementById('preco-alvo').innerHTML = formatarMoeda(precoAlvo);
        document.getElementById('preco-premium').innerHTML = formatarMoeda(precoPremium);
        
        document.getElementById('output-custo').innerHTML = formatarMoeda(custoBase);
        document.getElementById('output-impostos').innerHTML = formatarMoeda(impostos);
        document.getElementById('output-cs').innerHTML = formatarMoeda(cs);
        document.getElementById('output-margem-valor').innerHTML = formatarMoeda(precoAlvo - custoBase);
        document.getElementById('output-margem-pct').innerHTML = formatarPercentual((precoAlvo - custoBase) / precoAlvo);

        const entradaPct = parseFloat(document.getElementById('entrada').value) || 50;
        const parcelas = parseInt(document.getElementById('parcelas').value) || 1;
        const taxaJuros = parseFloat(document.getElementById('taxaParcelamento').value) || 1;
        
        const valorEntrada = precoAlvo * (entradaPct/100);
        const valorParcelas = (precoAlvo - valorEntrada) / parcelas;
        const valorTotalJuros = precoAlvo * Math.pow(1 + taxaJuros/100, parcelas);
        
        document.getElementById('output-entrada').innerHTML = formatarMoeda(valorEntrada);
        document.getElementById('output-parcelas').innerHTML = `${parcelas}x ${formatarMoeda(valorParcelas)}`;
        document.getElementById('output-total-juros').innerHTML = formatarMoeda(valorTotalJuros);

        // Alertas
        const alertas = [];
        
        if (precoComDesconto < precoPiso) {
            alertas.push({ tipo: 'critical', msg: '⚠️ Abaixo do piso' });
        }
        
        if (desconto > 15) {
            alertas.push({ tipo: 'warning', msg: '⚠️ Desconto acima da alçada (máx 15%)' });
        }
        
        if (tipoCobranca === 'exito' && custoBase > precoAlvo * 0.4) {
            alertas.push({ tipo: 'critical', msg: '⚠️ Modelo de êxito sem cobertura de custo' });
        }
        
        if (tipoCobranca === 'retainer' && !document.getElementById('escopo').value) {
            alertas.push({ tipo: 'warning', msg: '⚠️ Escopo sem limites (retainer)' });
        }
        
        if (document.getElementById('risco').value === 'alto') {
            alertas.push({ tipo: 'critical', msg: '⚠️ Risco alto de inadimplência' });
        }
        
        if (tipoCobranca === 'exito' && entradaPct < 30) {
            alertas.push({ tipo: 'warning', msg: '⚠️ Êxito: Recomendado entrada mínima de 30%' });
        }

        const alertasContainer = document.getElementById('alertas-container');
        alertasContainer.innerHTML = '';
        
        if (alertas.length === 0) {
            alertasContainer.innerHTML = '<div class="alert alert-success">✅ Nenhum alerta identificado</div>';
        } else {
            alertas.forEach(a => {
                alertasContainer.innerHTML += `<div class="alert alert-${a.tipo === 'critical' ? 'critical' : 'warning'}">${a.msg}</div>`;
            });
        }

        // Tabela de cálculo
        const corpoCalculo = document.getElementById('corpo-calculo');
        corpoCalculo.innerHTML = '';
        
        detalhamento.forEach(item => {
            corpoCalculo.innerHTML += `
                <tr>
                    <td>${item.perfil}</td>
                    <td>${item.horas}h</td>
                    <td>${formatarMoeda(item.custoHora)}</td>
                    <td>${formatarMoeda(item.custo)}</td>
                    <td>${formatarMoeda(item.custo * buffer)}</td>
                    <td>${formatarMoeda(item.custo * (1 + buffer))}</td>
                </tr>
            `;
        });

        document.getElementById('total-mao-obra').innerHTML = formatarMoeda(custoTotal);
        document.getElementById('total-overhead').innerHTML = formatarMoeda(overheadTotal);
        document.getElementById('subtotal-geral').innerHTML = formatarMoeda(custoTotal + overheadTotal);

        document.getElementById('composicao-custo').innerHTML = formatarMoeda(custoComBuffer);
        document.getElementById('composicao-impostos').innerHTML = formatarMoeda(impostos);
        document.getElementById('composicao-cs').innerHTML = formatarMoeda(cs);
        document.getElementById('composicao-parceiro').innerHTML = formatarMoeda(parceiro);
        document.getElementById('composicao-base').innerHTML = formatarMoeda(custoBase);
        document.getElementById('composicao-margem').innerHTML = formatarMoeda(precoAlvo - custoBase);

        // ===== PREPARAR DADOS COMPLETOS PARA SALVAR =====
        window.ultimoResultado = {
            ...coletarDadosInput(),
            margemHora: parseFloat(document.getElementById('margemHora')?.value) || 55,
            margemFechado: parseFloat(document.getElementById('margemFechado')?.value) || 47,
            margemRetainer: parseFloat(document.getElementById('margemRetainer')?.value) || 52,
            margemExito: parseFloat(document.getElementById('margemExito')?.value) || 65,
            margemHibrido: parseFloat(document.getElementById('margemHibrido')?.value) || 50,
            impostos: parseFloat(document.getElementById('impostos')?.value) || 11.33,
            taxaParcelamento: parseFloat(document.getElementById('taxaParcelamento')?.value) || 1,
            regimeTributario: document.getElementById('regimeTributario')?.value || 'lucro_presumido',
            csPadrao: parseFloat(document.getElementById('csPadrao')?.value) || 7.5,
            baseCS: document.getElementById('baseCS')?.value || 'liquido',
            bufferBaixa: parseFloat(document.getElementById('bufferBaixa')?.value) || 10,
            bufferMedia: parseFloat(document.getElementById('bufferMedia')?.value) || 20,
            bufferAlta: parseFloat(document.getElementById('bufferAlta')?.value) || 30,
            bufferNormal: parseFloat(document.getElementById('bufferNormal')?.value) || 0,
            bufferUrgencia: parseFloat(document.getElementById('bufferUrgencia')?.value) || 20,
            overheadTotal: overheadTotal,
            horasTotais: parseFloat(document.getElementById('horasTotais')?.value) || 840,
            buffer: buffer,
            custoTotalMO: custoTotal,
            detalhamentoCalculo: detalhamento,
            preco: precoAlvo,
            precoPiso: precoPiso,
            precoPremium: precoPremium,
            margem: ((precoAlvo - custoBase) / precoAlvo * 100).toFixed(1),
            margemValor: precoAlvo - custoBase,
            custoBase: custoBase,
            custoComBuffer: custoComBuffer,
            impostosCalculados: impostos,
            csCalculado: cs,
            parceiroValor: parceiro,
            valorEntrada: valorEntrada,
            valorParcelas: valorParcelas,
            valorTotalJuros: valorTotalJuros,
            alertas: alertas.map(a => a.msg).join('; '),
            id: indiceEditando !== -1 ? historico[indiceEditando].id : 'SP_' + new Date().getTime(),
            data: new Date().toLocaleString('pt-BR'),
            timestamp: new Date().toISOString(),
            usuario: usuarioAtual ? usuarioAtual.email : 'WebApp',
            dispositivo: navigator.userAgent
        };

        showTab('output');
        mostrarToast('✅ Cálculo realizado com sucesso!', 'success');

    } catch (error) {
        console.error('Erro:', error);
        mostrarToast('❌ Erro ao calcular. Verifique todos os campos.', 'error');
    }
}

// ========== FUNÇÕES PARA INTEGRAÇÃO COM GOOGLE SHEETS ==========

async function excluirDaNuvem(id) {
    try {
        console.log('🗑️ Excluindo da nuvem ID:', id);
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'excluirSimulacao', id: id })
        });
        return true;
    } catch(error) {
        console.error('❌ Erro ao excluir da nuvem:', error);
        return false;
    }
}

async function buscarDaNuvem(id) {
    try {
        console.log('🔍 Buscando da nuvem ID:', id);
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'buscarSimulacao', id: id })
        });
        return true;
    } catch(error) {
        console.error('❌ Erro ao buscar da nuvem:', error);
        return false;
    }
}

async function enviarTodasAbasParaPlanilha(dadosCompletos) {
    try {
        console.log('📤 Enviando dados para planilha:', dadosCompletos.cliente);
        const dadosEnvio = { action: 'salvarCompleto', dados: dadosCompletos };
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(dadosEnvio)
        });
        console.log('✅ Requisição enviada');
        return true;
    } catch(error) {
        console.error('❌ Erro ao enviar:', error);
        return false;
    }
}

async function testarConexaoGoogle() {
    try {
        console.log('🔄 Testando conexão...');
        mostrarToast('Testando conexão...', 'warning');
        const response = await fetch(GOOGLE_SHEETS_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'testarConexao' })
        });
        mostrarToast('✅ Conexão estabelecida!', 'success');
        return true;
    } catch(error) {
        console.error('❌ Erro:', error);
        mostrarToast('❌ Falha na conexão', 'error');
        return false;
    }
}

// ========== FUNÇÃO DE LIMPEZA DE CAMPOS ==========
function limparCamposAposEnvio() {
    const campoCliente = document.getElementById('cliente');
    if (campoCliente) campoCliente.value = '';
    
    const campoEscopo = document.getElementById('escopo');
    if (campoEscopo) campoEscopo.value = '';
    
    showTab('input');
    console.log('🧹 Campos Cliente e Escopo limpos');
}

// ========== FUNÇÃO DE SALVAR NO HISTÓRICO (CORRIGIDA) ==========
async function salvarHistorico(event) {
    if (!window.ultimoResultado) {
        mostrarToast('❌ Calcule um preço primeiro!', 'warning');
        return;
    }
    
    const btnSalvar = event?.target;
    const textoOriginal = btnSalvar?.innerHTML;
    if (btnSalvar) {
        btnSalvar.innerHTML = '<span class="spinner"></span> Salvando...';
        btnSalvar.disabled = true;
    }
    
    try {
        const isEditando = indiceEditando !== -1;
        
        // Garantir que margem e preco sejam números
        const resultadoParaSalvar = {
            ...window.ultimoResultado,
            margem: parseFloat(window.ultimoResultado.margem) || 0,
            preco: parseFloat(window.ultimoResultado.preco) || 0,
            margemValor: parseFloat(window.ultimoResultado.margemValor) || 0,
            custoBase: parseFloat(window.ultimoResultado.custoBase) || 0,
            entrada: parseFloat(window.ultimoResultado.entrada) || 50,
            parcelas: parseInt(window.ultimoResultado.parcelas) || 1,
            desconto: parseFloat(window.ultimoResultado.desconto) || 0,
            percParceiro: parseFloat(window.ultimoResultado.percParceiro) || 0,
            percCS: parseFloat(window.ultimoResultado.percCS) || 7.5,
            riscoEscopo: parseFloat(window.ultimoResultado.riscoEscopo) || 20
        };
        
        if (isEditando) {
            historico[indiceEditando] = resultadoParaSalvar;
            mostrarToast('✅ Simulação atualizada', 'success');
        } else {
            historico.unshift(resultadoParaSalvar);
            mostrarToast('✅ Nova simulação salva', 'success');
        }
        
        localStorage.setItem('historicoSmartPrice', JSON.stringify(historico));
        
        const enviado = await enviarTodasAbasParaPlanilha(resultadoParaSalvar);
        
        if (enviado) {
            mostrarToast('✅ Dados salvos no Google Sheets!', 'success');
            limparCamposAposEnvio();
        } else {
            mostrarToast('⚠️ Salvo localmente, falha na nuvem', 'warning');
        }
        
        if (isEditando) indiceEditando = -1;
        atualizarHistorico();
        
    } catch (error) {
        console.error('❌ Erro:', error);
        mostrarToast('❌ Erro ao salvar: ' + error.message, 'error');
    } finally {
        if (btnSalvar) {
            btnSalvar.innerHTML = textoOriginal;
            btnSalvar.disabled = false;
        }
    }
}

// ========== FUNÇÕES DE EXPORTAÇÃO ==========

function exportarExcel() {
    try {
        if (historico.length === 0) {
            mostrarToast('📭 Nenhum dado para exportar', 'warning');
            return;
        }
        
        const cabecalhos = ['ID', 'Data', 'Cliente', 'Produto', 'Preço (R$)', 'Margem (%)', 'Risco', 'Complexidade', 'Cobrança'];
        const dados = historico.map(item => {
            const preco = parseFloat(item.preco) || 0;
            const margem = parseFloat(item.margem) || 0;
            
            return [
                item.id || '', 
                item.data || '', 
                item.cliente || '', 
                item.produtoTexto || item.produto || '', 
                preco.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2}).replace('.', ','), 
                margem.toFixed(1).replace('.', ','), 
                item.risco || '', 
                item.complexidade || '', 
                item.cobrancaTexto || item.cobranca || ''
            ];
        });
        
        const conteudoCSV = [cabecalhos, ...dados].map(linha => linha.join(';')).join('\n');
        const blob = new Blob(["\uFEFF" + conteudoCSV], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `historico_${new Date().toISOString().split('T')[0]}.csv`;
        link.click();
        
        mostrarToast('📊 Histórico exportado como CSV!', 'success');
    } catch(error) {
        console.error('Erro:', error);
        mostrarToast('❌ Erro ao exportar', 'error');
    }
}

function exportarPDF() {
    try {
        if (historico.length === 0) {
            mostrarToast('📭 Nenhum dado para exportar', 'warning');
            return;
        }
        
        let conteudoHTML = `
            <!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"><title>MFBD - Histórico</title>
            <style>
                body { font-family: Arial; margin: 20px; }
                h1 { color: #1e293b; text-align: center; }
                table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                th { background: #1e293b; color: white; padding: 10px; }
                td { border: 1px solid #e2e8f0; padding: 8px; }
                .data { color: #64748b; text-align: right; }
                .moeda { text-align: right; }
            </style>
            </head>
            <body>
                <h1>MFBD - Precificação Inteligente</h1>
                <p class="data">Exportado em: ${new Date().toLocaleString('pt-BR')}</p>
                <p>Total de simulações: ${historico.length}</p>
                <table>
                    <tr><th>Cliente</th><th>Produto</th><th>Preço</th><th>Margem</th><th>Risco</th><th>Data</th></tr>
        `;
        
        historico.forEach(item => {
            const preco = parseFloat(item.preco) || 0;
            const margem = parseFloat(item.margem) || 0;
            
            conteudoHTML += `<tr>
                <td>${item.cliente || ''}</td>
                <td>${item.produtoTexto || item.produto || ''}</td>
                <td class="moeda">${formatarMoeda(preco)}</td>
                <td class="moeda">${margem.toFixed(1).replace('.', ',')}%</td>
                <td>${item.risco || ''}</td>
                <td>${item.data || ''}</td>
            </tr>`;
        });
        
        conteudoHTML += '</table></body></html>';
        
        const blob = new Blob([conteudoHTML], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = `historico_${new Date().toISOString().split('T')[0]}.html`;
        link.click();
        
        mostrarToast('📑 Histórico exportado como HTML!', 'success');
        
        if (confirm('Abrir para impressão?')) {
            const janela = window.open('', '_blank');
            janela.document.write(conteudoHTML);
            janela.document.close();
            janela.print();
        }
    } catch(error) {
        console.error('Erro:', error);
        mostrarToast('❌ Erro ao exportar', 'error');
    }
}

// ========== FUNÇÕES DO HISTÓRICO (CORRIGIDAS) ==========

function editarItem(indiceReal) {
    const item = historico[indiceReal];
    if (item) {
        indiceEditando = indiceReal;
        
        // Garantir que os valores numéricos sejam números
        const itemParaEditar = {
            ...item,
            preco: parseFloat(item.preco) || 0,
            margem: parseFloat(item.margem) || 0,
            entrada: parseFloat(item.entrada) || 50,
            parcelas: parseInt(item.parcelas) || 1,
            desconto: parseFloat(item.desconto) || 0,
            percParceiro: parseFloat(item.percParceiro) || 0,
            percCS: parseFloat(item.percCS) || 7.5,
            riscoEscopo: parseFloat(item.riscoEscopo) || 20
        };
        
        preencherInputComDados(itemParaEditar);
        showTab('input');
        fecharModal();
        mostrarToast(`✏️ Editando: ${item.cliente}`, 'warning');
    }
}

async function excluirItem(indiceReal) {
    const item = historico[indiceReal];
    if (confirm(`🗑️ Excluir "${item.cliente}" de TODAS as abas?`)) {
        mostrarToast('Excluindo...', 'warning');
        const excluidoNuvem = await excluirDaNuvem(item.id);
        
        if (excluidoNuvem) mostrarToast('✅ Excluído da nuvem', 'success');
        else mostrarToast('⚠️ Falha na nuvem', 'warning');
        
        historico.splice(indiceReal, 1);
        localStorage.setItem('historicoSmartPrice', JSON.stringify(historico));
        atualizarHistorico();
        fecharModal();
    }
}

function abrirModalEdicao(indiceReal) {
    const item = historico[indiceReal];
    if (!item) return;
    
    const modal = document.getElementById('modalEdicao');
    const conteudo = document.getElementById('modal-conteudo');
    
    // Garantir que os valores sejam números
    const preco = parseFloat(item.preco) || 0;
    const margem = parseFloat(item.margem) || 0;
    
    const riscoClass = item.risco === 'alto' ? 'badge-danger' : item.risco === 'medio' ? 'badge-warning' : 'badge-success';
    const riscoLabel = item.risco === 'alto' ? 'Alto' : item.risco === 'medio' ? 'Médio' : 'Baixo';
    
    conteudo.innerHTML = `
        <p><strong>ID:</strong> ${item.id}</p>
        <p><strong>Cliente:</strong> ${item.cliente}</p>
        <p><strong>Produto:</strong> ${item.produtoTexto || item.produto}</p>
        <p><strong>Preço:</strong> ${formatarMoeda(preco)}</p>
        <p><strong>Margem:</strong> ${margem.toFixed(1).replace('.', ',')}%</p>
        <p><strong>Risco:</strong> <span class="badge ${riscoClass}">${riscoLabel}</span></p>
        <p><strong>Data:</strong> ${item.data}</p>
        <div class="button-group" style="display: flex; gap: 10px; justify-content: center; margin-top: 20px;">
            <button class="btn btn-warning" onclick="editarItem(${indiceReal})" style="flex:1;">✏️ Editar</button>
            <button class="btn btn-danger" onclick="excluirItem(${indiceReal})" style="flex:1;">🗑️ Excluir</button>
            <button class="btn btn-secondary" onclick="fecharModal()" style="flex:1;">Fechar</button>
        </div>
    `;
    
    modal.classList.add('active');
}

function atualizarHistorico() {
    const lista = document.getElementById('historico-lista');
    const filtro = document.getElementById('filtroCliente')?.value?.toLowerCase() || '';
    const ordenar = document.getElementById('ordenarPor')?.value || 'data';
    
    let historicoFiltrado = historico.filter(item => 
        item.cliente && item.cliente.toLowerCase().includes(filtro)
    );
    
    if (ordenar === 'data') {
        historicoFiltrado.sort((a, b) => new Date(b.data) - new Date(a.data));
    } else if (ordenar === 'cliente') {
        historicoFiltrado.sort((a, b) => (a.cliente || '').localeCompare(b.cliente || ''));
    } else if (ordenar === 'preco') {
        historicoFiltrado.sort((a, b) => (parseFloat(b.preco) || 0) - (parseFloat(a.preco) || 0));
    } else if (ordenar === 'margem') {
        historicoFiltrado.sort((a, b) => (parseFloat(b.margem) || 0) - (parseFloat(a.margem) || 0));
    }
    
    lista.innerHTML = '';
    document.getElementById('total-simulacoes').textContent = historicoFiltrado.length;
    
    if (historicoFiltrado.length === 0) {
        lista.innerHTML = '<p class="text-center" style="padding: 40px;">📭 Nenhuma simulação encontrada</p>';
        return;
    }
    
    historicoFiltrado.forEach(item => {
        const indiceReal = historico.findIndex(h => h.id === item.id);
        if (indiceReal === -1) return;
        
        // Garantir que os valores sejam números
        const preco = parseFloat(item.preco) || 0;
        const margem = parseFloat(item.margem) || 0;
        
        const riscoClass = item.risco === 'alto' ? 'badge-danger' : item.risco === 'medio' ? 'badge-warning' : 'badge-success';
        const riscoLabel = item.risco === 'alto' ? 'Alto' : item.risco === 'medio' ? 'Médio' : 'Baixo';
        const isRecent = indiceReal === 0;
        
        lista.innerHTML += `
            <div class="historico-item" onclick="abrirModalEdicao(${indiceReal})">
                <div class="historico-header">
                    <span class="historico-titulo">
                        ${item.cliente}
                        ${isRecent ? '<span style="background:#3b82f6; color:white; padding:2px 8px; border-radius:12px; font-size:10px;">🆕 Recente</span>' : ''}
                        <span style="font-size:10px; color:#64748b;">${item.id}</span>
                    </span>
                    <div class="historico-acoes" onclick="event.stopPropagation()">
                        <button style="background:#f59e0b; color:white;" onclick="editarItem(${indiceReal})">✏️</button>
                        <button style="background:#ef4444; color:white;" onclick="excluirItem(${indiceReal})">🗑️</button>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-top: 10px;">
                    <div><small>Produto</small><br><strong>${item.produtoTexto || item.produto}</strong></div>
                    <div><small>Preço</small><br><strong>${formatarMoeda(preco)}</strong></div>
                    <div><small>Margem</small><br><strong>${margem.toFixed(1).replace('.', ',')}%</strong></div>
                    <div><small>Risco</small><br><span class="badge ${riscoClass}">${riscoLabel}</span></div>
                </div>
                <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                    <span>${item.data}</span>
                    ${isRecent ? '<span style="color:#3b82f6; float:right;">⬆️ Último</span>' : ''}
                </div>
            </div>
        `;
    });
}

function exportarHistorico() {
    const dataStr = JSON.stringify(historico, null, 2);
    const dataUri = 'data:application/json;charset=utf-8,'+ encodeURIComponent(dataStr);
    const link = document.createElement('a');
    link.href = dataUri;
    link.download = `historico_${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    mostrarToast('📤 Histórico exportado!', 'success');
}

// ========== FUNÇÃO PARA ATUALIZAR TODOS OS CUSTOS ==========
function atualizarTodosCustos() {
    const perfis = ['Estag', 'Jr', 'Pl', 'Sr', 'Coord', 'Socio'];
    const overheadTotal = parseFloat(document.getElementById('overheadTotal')?.value) || 45000;
    const horasTotais = parseFloat(document.getElementById('horasTotais')?.value) || 840;
    const overheadHora = overheadTotal / horasTotais;
    
    const overheadPorHora = document.getElementById('overheadPorHora');
    if (overheadPorHora) overheadPorHora.textContent = formatarMoeda(overheadHora).replace('R$', 'R$');
    
    perfis.forEach(perfil => {
        const salario = parseFloat(document.getElementById(`salario${perfil}`)?.value) || 0;
        const beneficios = parseFloat(document.getElementById(`beneficios${perfil}`)?.value) || 0;
        const horas = parseFloat(document.getElementById(`horas${perfil}`)?.value) || 140;
        
        const encargos = salario * 0.72;
        const totalMensal = salario + encargos + beneficios;
        const custoHora = (totalMensal / horas) + overheadHora;
        
        const encargosEl = document.getElementById(`encargos${perfil}`);
        const totalMensalEl = document.getElementById(`totalMensal${perfil}`);
        const overheadHoraEl = document.getElementById(`overheadHora${perfil}`);
        const custoHoraEl = document.getElementById(`custoHora${perfil}`);
        
        if (encargosEl) encargosEl.textContent = Math.round(encargos).toLocaleString('pt-BR');
        if (totalMensalEl) totalMensalEl.textContent = Math.round(totalMensal).toLocaleString('pt-BR');
        if (overheadHoraEl) overheadHoraEl.textContent = formatarMoeda(overheadHora).replace('R$', 'R$');
        if (custoHoraEl) custoHoraEl.textContent = formatarMoeda(custoHora).replace('R$', '');
    });
}

// ========== FUNÇÃO PARA LIMPAR HISTÓRICO CORROMPIDO ==========
function limparHistoricoCorrompido() {
    try {
        const historicoLimpo = [];
        
        historico.forEach(item => {
            // Tentar converter valores para números
            const itemLimpo = {
                ...item,
                preco: parseFloat(item.preco) || 0,
                margem: parseFloat(item.margem) || 0,
                entrada: parseFloat(item.entrada) || 50,
                parcelas: parseInt(item.parcelas) || 1,
                desconto: parseFloat(item.desconto) || 0,
                percParceiro: parseFloat(item.percParceiro) || 0,
                percCS: parseFloat(item.percCS) || 7.5,
                riscoEscopo: parseFloat(item.riscoEscopo) || 20
            };
            historicoLimpo.push(itemLimpo);
        });
        
        historico = historicoLimpo;
        localStorage.setItem('historicoSmartPrice', JSON.stringify(historico));
        atualizarHistorico();
        mostrarToast('✅ Histórico limpo e corrigido!', 'success');
    } catch (error) {
        console.error('Erro ao limpar histórico:', error);
        mostrarToast('❌ Erro ao limpar histórico', 'error');
    }
}

// ========== INICIALIZAÇÃO ==========
window.onload = function() {
    console.log('🚀 Inicializando MFBD v5.0...');
    
    // Primeiro verificar se já está logado
    verificarSessao();
    
    // Restante da inicialização
    if (typeof historico !== 'undefined' && historico) {
        historico.sort((a, b) => new Date(b.data) - new Date(a.data));
    }
    
    // Adicionar primeiro perfil se necessário
    setTimeout(() => {
        if (document.querySelectorAll('.perfil-row').length === 0) {
            adicionarPerfil();
        }
    }, 200);
    
    // Configurar radio buttons
    document.querySelectorAll('.radio-option').forEach(option => {
        option.addEventListener('click', function() {
            const radio = this.querySelector('input[type="radio"]');
            if (radio) {
                radio.checked = true;
                document.querySelectorAll('.radio-option').forEach(opt => opt.classList.remove('selected'));
                this.classList.add('selected');
            }
        });
    });
    
    // Configurar inputs de custo
    const perfis = ['Estag', 'Jr', 'Pl', 'Sr', 'Coord', 'Socio'];
    perfis.forEach(perfil => {
        const salario = document.getElementById(`salario${perfil}`);
        const beneficios = document.getElementById(`beneficios${perfil}`);
        const horas = document.getElementById(`horas${perfil}`);
        if (salario) salario.addEventListener('input', atualizarTodosCustos);
        if (beneficios) beneficios.addEventListener('input', atualizarTodosCustos);
        if (horas) horas.addEventListener('input', atualizarTodosCustos);
    });
    
    document.getElementById('overheadTotal')?.addEventListener('input', atualizarTodosCustos);
    document.getElementById('horasTotais')?.addEventListener('input', atualizarTodosCustos);
    
    atualizarTodosCustos();
    
    document.getElementById('filtroCliente')?.addEventListener('input', atualizarHistorico);
    document.getElementById('ordenarPor')?.addEventListener('change', atualizarHistorico);
    
    window.addEventListener('click', (event) => {
        if (event.target === document.getElementById('modalEdicao')) fecharModal();
    });
    
    atualizarHistorico();
    indiceEditando = -1;
    
    console.log('✅ MFBD - Sistema carregado v5.0');
};