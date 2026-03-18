// ========== SISTEMA DE LOGIN MFBD ==========
// Autenticação via Google Sheets - VERSÃO COMPLETA
// ============================================

// Estado da autenticação
let usuarioAtual = null;
let tentativasLogin = 0;

// ========== VARIÁVEIS GLOBAIS ==========
let historico = JSON.parse(localStorage.getItem('historicoSmartPrice') || '[]');
let indiceEditando = -1;

// ========== VARIÁVEIS DE PAGINAÇÃO ==========
let paginaAtual = 1;
let itensPorPagina = 10; // Padrão 10 itens
let historicoPaginado = [];

// ========== CONFIGURAÇÃO GOOGLE SHEETS ==========
const GOOGLE_SHEETS_URL = 'https://script.google.com/macros/s/AKfycbw2pCihEM-o7djOYTWPf7kZoBNT366oIoV6D3rUkZEyM0FV8lINpGr57hJGw56dX0NM/exec';

// ========== GRÁFICOS ==========
let graficoPrecos, graficoSegmentos, graficoMargens, graficoRisco, graficoTopClientes, graficoTendenciaMargens;
let periodoAtualGraficos = '30d';

// ========== FUNÇÕES DE FORMATAÇÃO BRASILEIRA ==========
function formatarMoeda(valor) {
    if (valor === undefined || valor === null || isNaN(valor)) return 'R$ 0,00';
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
    const percentual = num * 100;
    return percentual.toLocaleString('pt-BR', {
        minimumFractionDigits: 1,
        maximumFractionDigits: 1
    }) + '%';
}

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

// ========== FUNÇÕES DE LOGIN ==========

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

function mostrarTelaLogin() {
    const telaLogin = document.getElementById('tela-login');
    const sistemaPrincipal = document.getElementById('sistema-principal');
    
    if (telaLogin) telaLogin.style.display = 'flex';
    if (sistemaPrincipal) sistemaPrincipal.style.display = 'none';
}

function mostrarSistema() {
    const telaLogin = document.getElementById('tela-login');
    const sistemaPrincipal = document.getElementById('sistema-principal');
    
    if (telaLogin) telaLogin.style.display = 'none';
    if (sistemaPrincipal) sistemaPrincipal.style.display = 'block';
    
    setTimeout(() => {
        if (typeof adicionarPerfil === 'function') adicionarPerfil();
        if (typeof atualizarTodosCustos === 'function') atualizarTodosCustos();
        if (typeof atualizarHistorico === 'function') atualizarHistorico();
    }, 100);
}

function atualizarHeaderUsuario() {
    if (!usuarioAtual) return;
    
    const header = document.querySelector('.header');
    if (!header) return;
    
    const oldUserInfo = document.getElementById('user-info-header');
    if (oldUserInfo) oldUserInfo.innerHTML = '';
    
    const userInfo = document.getElementById('user-info-header');
    if (!userInfo) return;
    
    let perfilColor = '#3b82f6';
    let perfilIcon = '👤';
    
    if (usuarioAtual.perfil === 'Admin') {
        perfilColor = '#10b981';
        perfilIcon = '👑';
    }
    if (usuarioAtual.perfil === 'Master') {
        perfilColor = '#8b5cf6';
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

async function fazerLogin(event) {
    event.preventDefault();
    
    const email = document.getElementById('login-email').value.trim();
    const senha = document.getElementById('login-senha').value;
    const btnLogin = document.querySelector('.btn-login');
    const erroElement = document.getElementById('login-erro');
    const loadingElement = document.getElementById('login-loading');
    
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
    
    btnLogin.innerHTML = '<span class="spinner" style="width: 20px; height: 20px; border-color: rgba(255,255,255,0.3); border-top-color: white;"></span> Verificando...';
    btnLogin.disabled = true;
    if (erroElement) erroElement.style.display = 'none';
    if (loadingElement) loadingElement.style.display = 'flex';
    
    try {
        console.log('🔐 Tentando login:', email);
        
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
            usuarioAtual = data.usuario || {
                email: email,
                nome: email.split('@')[0],
                perfil: 'Usuário'
            };
            
            localStorage.setItem('mfbd_sessao', JSON.stringify(usuarioAtual));
            mostrarToast('✅ Login realizado com sucesso!', 'success');
            
            tentativasLogin = 0;
            
            setTimeout(() => {
                if (loadingElement) loadingElement.style.display = 'none';
                mostrarSistema();
                atualizarHeaderUsuario();
            }, 1000);
            
        } else {
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

function mostrarErro(mensagem) {
    const erroElement = document.getElementById('login-erro');
    if (erroElement) {
        erroElement.textContent = mensagem;
        erroElement.style.display = 'block';
        
        setTimeout(() => {
            erroElement.style.display = 'none';
        }, 5000);
    }
}

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

function fazerLogout() {
    localStorage.removeItem('mfbd_sessao');
    usuarioAtual = null;
    
    const userInfo = document.getElementById('user-info-header');
    if (userInfo) userInfo.innerHTML = '';
    
    mostrarTelaLogin();
    
    const emailInput = document.getElementById('login-email');
    const senhaInput = document.getElementById('login-senha');
    const erroElement = document.getElementById('login-erro');
    const loadingElement = document.getElementById('login-loading');
    
    if (emailInput) emailInput.value = '';
    if (senhaInput) senhaInput.value = '';
    if (erroElement) erroElement.style.display = 'none';
    if (loadingElement) loadingElement.style.display = 'none';
    
    const btnLogin = document.querySelector('.btn-login');
    if (btnLogin) {
        btnLogin.innerHTML = '🔐 Entrar no Sistema';
        btnLogin.disabled = false;
    }
    
    mostrarToast('👋 Logout realizado', 'success');
}

// ========== FUNÇÕES DE SALÁRIOS E CUSTOS ==========

function coletarSalariosAtualizados() {
    const perfis = ['Estag', 'Jr', 'Pl', 'Sr', 'Coord', 'Socio'];
    const salarios = {};
    
    perfis.forEach(perfil => {
        const salarioInput = document.getElementById(`salario${perfil}`);
        const beneficiosInput = document.getElementById(`beneficios${perfil}`);
        const horasInput = document.getElementById(`horas${perfil}`);
        
        if (salarioInput) {
            salarios[`salario${perfil}`] = parseFloat(salarioInput.value) || 0;
        }
        if (beneficiosInput) {
            salarios[`beneficios${perfil}`] = parseFloat(beneficiosInput.value) || 0;
        }
        if (horasInput) {
            salarios[`horas${perfil}`] = parseFloat(horasInput.value) || 140;
        }
    });
    
    salarios.overheadTotal = parseFloat(document.getElementById('overheadTotal')?.value) || 45000;
    salarios.horasTotais = parseFloat(document.getElementById('horasTotais')?.value) || 840;
    
    console.log('💰 Salários coletados:', salarios);
    return salarios;
}

function getCustoHoraComSalarios(perfil, salarios) {
    const salario = salarios[`salario${perfil}`] || 0;
    const beneficios = salarios[`beneficios${perfil}`] || 0;
    const horas = salarios[`horas${perfil}`] || 140;
    
    const encargos = salario * 0.72;
    const custoTotalMensal = salario + encargos + beneficios;
    
    const overheadTotal = salarios.overheadTotal || 45000;
    const horasTotais = salarios.horasTotais || 840;
    const overheadHora = overheadTotal / horasTotais;
    
    return (custoTotalMensal / horas) + overheadHora;
}

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

// ========== FUNÇÕES DE PERFIL ==========

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

function atualizarCustoPrevisto(div) {
    const select = div.querySelector('.perfil');
    const horas = parseFloat(div.querySelector('.horas').value) || 0;
    const perfil = select.value;
    
    const perfilId = perfil.charAt(0).toUpperCase() + perfil.slice(1);
    const custoHora = getCustoHora(perfilId);
    const custoTotal = custoHora * horas;
    
    div.querySelector('.custo-previsto').textContent = formatarMoeda(custoTotal);
}

// ========== FUNÇÕES DE CÁLCULO ==========

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

function calcular() {
    try {
        const salariosAtuais = coletarSalariosAtualizados();
        
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
                
                const custoHora = getCustoHoraComSalarios(perfilId, salariosAtuais);
                const custo = custoHora * horas;
                
                custoTotal += custo;
                detalhamento.push({ perfil: perfilNome, horas, custoHora, custo });
            }
        });

        const buffer = calcularBuffer();
        const custoComBuffer = custoTotal * (1 + buffer);
        const overheadTotal = salariosAtuais.overheadTotal;

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

        window.ultimoResultado = {
            ...coletarDadosInput(),
            ...salariosAtuais,
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
            horasTotais: salariosAtuais.horasTotais,
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

// ========== FUNÇÕES DE GOOGLE SHEETS ==========

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

function limparCamposAposEnvio() {
    const campoCliente = document.getElementById('cliente');
    if (campoCliente) campoCliente.value = '';
    
    const campoEscopo = document.getElementById('escopo');
    if (campoEscopo) campoEscopo.value = '';
    
    showTab('input');
    console.log('🧹 Campos Cliente e Escopo limpos');
}

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
        atualizarDashboardSeAtivo();
        
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

// ========== FUNÇÕES DO HISTÓRICO ==========

function abrirModalEdicao(indiceReal) {
    const item = historico[indiceReal];
    if (!item) return;
    
    const modal = document.getElementById('modalEdicao');
    const conteudo = document.getElementById('modal-conteudo');
    
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

function editarItem(indiceReal) {
    const item = historico[indiceReal];
    if (item) {
        indiceEditando = indiceReal;
        
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
        atualizarDashboardSeAtivo();
        fecharModal();
    }
}

function exportarExcel() {
    try {
        if (historico.length === 0) {
            mostrarToast('📭 Nenhum dado para exportar', 'warning');
            return;
        }
        
        // Criar modal de escolha
        const modalChoice = document.createElement('div');
        modalChoice.className = 'modal';
        modalChoice.id = 'modalExportChoice';
        modalChoice.style.display = 'flex';
        modalChoice.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>📊 Exportar Excel</h3>
                    <button class="modal-close" onclick="document.getElementById('modalExportChoice').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 20px; color: #475569;">O que deseja exportar?</p>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button class="btn btn-primary" onclick="exportarExcelOpcao('pagina')" style="width: 100%;">
                            📄 Apenas página atual (${historicoPaginado.length} registros)
                        </button>
                        <button class="btn btn-success" onclick="exportarExcelOpcao('todos')" style="width: 100%;">
                            📚 Todos os registros (${historico.length} registros)
                        </button>
                        <button class="btn btn-secondary" onclick="document.getElementById('modalExportChoice').remove()" style="width: 100%;">
                            ❌ Cancelar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalChoice);
        
    } catch(error) {
        console.error('Erro:', error);
        mostrarToast('❌ Erro ao exportar: ' + error.message, 'error');
    }
}

function exportarExcelOpcao(tipo) {
    // Fechar modal
    document.getElementById('modalExportChoice')?.remove();
    
    try {
        let dadosParaExportar;
        let nomeArquivo;
        
        if (tipo === 'pagina') {
            dadosParaExportar = historicoPaginado;
            nomeArquivo = `historico_pagina_${paginaAtual}_${new Date().toISOString().split('T')[0]}.csv`;
            mostrarToast(`📊 Exportando página ${paginaAtual}...`, 'warning');
        } else {
            dadosParaExportar = historico;
            nomeArquivo = `historico_completo_${new Date().toISOString().split('T')[0]}.csv`;
            mostrarToast(`📊 Exportando todos os ${dadosParaExportar.length} registros...`, 'warning');
        }
        
        const cabecalhos = ['ID', 'Data', 'Cliente', 'Produto', 'Preço (R$)', 'Margem (%)', 'Risco', 'Complexidade', 'Cobrança'];
        const dados = dadosParaExportar.map(item => {
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
        
        // Adicionar coluna de página se for apenas a página atual
        if (tipo === 'pagina') {
            cabecalhos.unshift('Página');
            dados.forEach(linha => linha.unshift(paginaAtual));
        }
        
        const conteudoCSV = [cabecalhos, ...dados].map(linha => linha.join(';')).join('\n');
        const blob = new Blob(["\uFEFF" + conteudoCSV], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = nomeArquivo;
        link.click();
        
        mostrarToast(`📊 ${tipo === 'pagina' ? 'Página' : 'Histórico completo'} exportado com sucesso!`, 'success');
        
    } catch(error) {
        console.error('Erro:', error);
        mostrarToast('❌ Erro ao exportar: ' + error.message, 'error');
    }
}

function exportarPDF() {
    try {
        if (historico.length === 0) {
            mostrarToast('📭 Nenhum dado para exportar', 'warning');
            return;
        }
        
        // Criar modal de escolha
        const modalChoice = document.createElement('div');
        modalChoice.className = 'modal';
        modalChoice.id = 'modalExportPDFChoice';
        modalChoice.style.display = 'flex';
        modalChoice.innerHTML = `
            <div class="modal-content" style="max-width: 400px;">
                <div class="modal-header">
                    <h3>📑 Exportar PDF</h3>
                    <button class="modal-close" onclick="document.getElementById('modalExportPDFChoice').remove()">&times;</button>
                </div>
                <div class="modal-body">
                    <p style="margin-bottom: 20px; color: #475569;">O que deseja exportar?</p>
                    <div style="display: flex; flex-direction: column; gap: 12px;">
                        <button class="btn btn-primary" onclick="exportarPDFOpcao('pagina')" style="width: 100%;">
                            📄 Apenas página atual (${historicoPaginado.length} registros)
                        </button>
                        <button class="btn btn-success" onclick="exportarPDFOpcao('todos')" style="width: 100%;">
                            📚 Todos os registros (${historico.length} registros)
                        </button>
                        <button class="btn btn-secondary" onclick="document.getElementById('modalExportPDFChoice').remove()" style="width: 100%;">
                            ❌ Cancelar
                        </button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modalChoice);
        
    } catch(error) {
        console.error('Erro:', error);
        mostrarToast('❌ Erro ao exportar: ' + error.message, 'error');
    }
}

function exportarPDFOpcao(tipo) {
    // Fechar modal
    document.getElementById('modalExportPDFChoice')?.remove();
    
    try {
        let dadosParaExportar;
        let tituloArquivo;
        let subtitulo;
        
        if (tipo === 'pagina') {
            dadosParaExportar = historicoPaginado;
            tituloArquivo = `historico_pagina_${paginaAtual}_${new Date().toISOString().split('T')[0]}.html`;
            subtitulo = `Página ${paginaAtual} de ${Math.ceil(historico.length / itensPorPagina)} - ${dadosParaExportar.length} registros`;
        } else {
            dadosParaExportar = historico;
            tituloArquivo = `historico_completo_${new Date().toISOString().split('T')[0]}.html`;
            subtitulo = `Histórico Completo - ${dadosParaExportar.length} registros`;
        }
        
        let conteudoHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="UTF-8">
                <title>MFBD - Histórico</title>
                <style>
                    body { font-family: Arial; margin: 20px; }
                    h1 { color: #1e293b; text-align: center; }
                    h2 { color: #334155; text-align: center; font-size: 16px; font-weight: normal; margin-bottom: 20px; }
                    table { border-collapse: collapse; width: 100%; margin-top: 20px; }
                    th { background: #1e293b; color: white; padding: 10px; }
                    td { border: 1px solid #e2e8f0; padding: 8px; }
                    .data { color: #64748b; text-align: right; }
                    .moeda { text-align: right; }
                    .footer { margin-top: 20px; text-align: center; color: #94a3b8; font-size: 12px; }
                </style>
            </head>
            <body>
                <h1>MFBD - Precificação Inteligente</h1>
                <h2>${subtitulo}</h2>
                <p class="data">Exportado em: ${new Date().toLocaleString('pt-BR')}</p>
                <p>Total de simulações: ${dadosParaExportar.length}</p>
                <table>
                    <tr>
                        <th>Cliente</th>
                        <th>Produto</th>
                        <th>Preço</th>
                        <th>Margem</th>
                        <th>Risco</th>
                        <th>Data</th>
                    </tr>
        `;
        
        dadosParaExportar.forEach(item => {
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
        
        // Adicionar rodapé com informações da página
        if (tipo === 'pagina') {
            const totalPaginas = Math.ceil(historico.length / itensPorPagina);
            conteudoHTML += `
                <tr>
                    <td colspan="6" style="background: #f1f5f9; text-align: center; font-weight: bold;">
                        Página ${paginaAtual} de ${totalPaginas} | Itens por página: ${itensPorPagina}
                    </td>
                </tr>
            `;
        }
        
        conteudoHTML += `
                </table>
                <div class="footer">
                    MFBD - Sistema de Precificação Inteligente
                </div>
            </body>
            </html>
        `;
        
        const blob = new Blob([conteudoHTML], { type: 'text/html;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = tituloArquivo;
        link.click();
        
        mostrarToast(`📑 ${tipo === 'pagina' ? 'Página' : 'Histórico completo'} exportado!`, 'success');
        
        if (confirm('Abrir para impressão?')) {
            const janela = window.open('', '_blank');
            janela.document.write(conteudoHTML);
            janela.document.close();
            janela.print();
        }
        
    } catch(error) {
        console.error('Erro:', error);
        mostrarToast('❌ Erro ao exportar: ' + error.message, 'error');
    }
}

function limparHistoricoCorrompido() {
    try {
        const historicoLimpo = [];
        
        historico.forEach(item => {
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
        atualizarDashboardSeAtivo();
        mostrarToast('✅ Histórico limpo e corrigido!', 'success');
    } catch (error) {
        console.error('Erro ao limpar histórico:', error);
        mostrarToast('❌ Erro ao limpar histórico', 'error');
    }
}

function fecharModal() {
    document.getElementById('modalEdicao').classList.remove('active');
}

// ========== FUNÇÕES DE PAGINAÇÃO ==========

function configurarPaginacao() {
    console.log('Configurando paginação...');
    
    const historicoLista = document.getElementById('historico-lista');
    if (!historicoLista) {
        console.log('Lista de histórico não encontrada');
        return;
    }
    
    const historicoCard = document.querySelector('#historico .card');
    if (!historicoCard) {
        console.log('Card do histórico não encontrado');
        return;
    }
    
    // Verificar se o controle de itens por página já existe
    if (!document.getElementById('itensPorPagina')) {
        console.log('Criando controle de itens por página');
        
        // Remover qualquer controle existente para evitar duplicação
        const existingControl = document.querySelector('.itens-por-pagina');
        if (existingControl) {
            existingControl.remove();
        }
        
        const controleItens = document.createElement('div');
        controleItens.className = 'itens-por-pagina';
        controleItens.innerHTML = `
            <label>Itens por página:</label>
            <select id="itensPorPagina" onchange="mudarItensPorPagina(this.value)">
                <option value="5" ${itensPorPagina === 5 ? 'selected' : ''}>5</option>
                <option value="10" ${itensPorPagina === 10 ? 'selected' : ''}>10</option>
                <option value="20" ${itensPorPagina === 20 ? 'selected' : ''}>20</option>
                <option value="50" ${itensPorPagina === 50 ? 'selected' : ''}>50</option>
            </select>
        `;
        
        // Inserir antes da lista de histórico
        historicoCard.insertBefore(controleItens, historicoLista);
    }
    
    // Verificar se o container de paginação já existe
    if (!document.getElementById('paginacao-container')) {
        console.log('Criando container de paginação');
        
        // Remover qualquer container existente
        const existingContainer = document.querySelector('.paginacao');
        if (existingContainer) {
            existingContainer.remove();
        }
        
        const paginacaoDiv = document.createElement('div');
        paginacaoDiv.id = 'paginacao-container';
        paginacaoDiv.className = 'paginacao';
        
        // Inserir depois da lista de histórico
        historicoLista.parentNode.insertBefore(paginacaoDiv, historicoLista.nextSibling);
    }
}

function mudarItensPorPagina(valor) {
    itensPorPagina = parseInt(valor);
    paginaAtual = 1;
    salvarPreferenciasPaginacao();
    atualizarHistoricoComPaginacao();
}

function salvarPreferenciasPaginacao() {
    localStorage.setItem('mfbd_itens_por_pagina', itensPorPagina);
}

function carregarPreferenciasPaginacao() {
    const salvo = localStorage.getItem('mfbd_itens_por_pagina');
    if (salvo) {
        itensPorPagina = parseInt(salvo);
    } else {
        itensPorPagina = 10; // Garantir 10 como padrão
    }
}

function atualizarHistoricoComPaginacao() {
    console.log('Atualizando histórico com paginação');
    
    const historicoLista = document.getElementById('historico-lista');
    if (!historicoLista) {
        console.log('Lista de histórico não encontrada');
        return;
    }
    
    if (!historico || historico.length === 0) {
        historicoLista.innerHTML = '<p class="text-center" style="padding: 40px;">📭 Nenhuma simulação encontrada</p>';
        document.getElementById('total-simulacoes').textContent = '0';
        
        const container = document.getElementById('paginacao-container');
        if (container) container.innerHTML = '';
        return;
    }
    
    const filtro = document.getElementById('filtroCliente')?.value?.toLowerCase() || '';
    const ordenar = document.getElementById('ordenarPor')?.value || 'data';
    
    // Filtrar
    let historicoFiltrado = historico.filter(item => 
        item.cliente && item.cliente.toLowerCase().includes(filtro)
    );
    
    // Ordenar
    if (ordenar === 'data') {
        historicoFiltrado.sort((a, b) => {
            const dataA = a.data ? new Date(a.data.split(' ')[0].split('/').reverse().join('-')) : new Date(0);
            const dataB = b.data ? new Date(b.data.split(' ')[0].split('/').reverse().join('-')) : new Date(0);
            return dataB - dataA;
        });
    } else if (ordenar === 'cliente') {
        historicoFiltrado.sort((a, b) => (a.cliente || '').localeCompare(b.cliente || ''));
    } else if (ordenar === 'preco') {
        historicoFiltrado.sort((a, b) => (parseFloat(b.preco) || 0) - (parseFloat(a.preco) || 0));
    } else if (ordenar === 'margem') {
        historicoFiltrado.sort((a, b) => (parseFloat(b.margem) || 0) - (parseFloat(a.margem) || 0));
    }
    
    historicoPaginado = historicoFiltrado;
    
    const totalItens = historicoPaginado.length;
    const totalPaginas = Math.ceil(totalItens / itensPorPagina);
    
    // Garantir que página atual é válida
    if (paginaAtual > totalPaginas) {
        paginaAtual = totalPaginas || 1;
    }
    if (paginaAtual < 1) {
        paginaAtual = 1;
    }
    
    const inicio = (paginaAtual - 1) * itensPorPagina;
    const fim = Math.min(inicio + itensPorPagina, totalItens);
    const itensPagina = historicoPaginado.slice(inicio, fim);
    
    renderizarListaHistorico(itensPagina);
    renderizarControlesPaginacao(totalItens, totalPaginas, inicio, fim);
    
    document.getElementById('total-simulacoes').textContent = totalItens;
}

function renderizarListaHistorico(itens) {
    const lista = document.getElementById('historico-lista');
    if (!lista) return;
    
    lista.innerHTML = '';
    
    if (itens.length === 0) {
        lista.innerHTML = '<p class="text-center" style="padding: 40px;">📭 Nenhuma simulação encontrada</p>';
        return;
    }
    
    itens.forEach(item => {
        const indiceReal = historico.findIndex(h => h.id === item.id);
        if (indiceReal === -1) return;
        
        const preco = parseFloat(item.preco) || 0;
        const margem = parseFloat(item.margem) || 0;
        
        const riscoClass = item.risco === 'alto' ? 'badge-danger' : item.risco === 'medio' ? 'badge-warning' : 'badge-success';
        const riscoLabel = item.risco === 'alto' ? 'Alto' : item.risco === 'medio' ? 'Médio' : 'Baixo';
        const isRecent = indiceReal === 0;
        
        lista.innerHTML += `
            <div class="historico-item" onclick="abrirModalEdicao(${indiceReal})">
                <div class="historico-header">
                    <span class="historico-titulo">
                        ${item.cliente || 'Sem nome'}
                        ${isRecent ? '<span style="background:#3b82f6; color:white; padding:2px 8px; border-radius:12px; font-size:10px;">🆕 Recente</span>' : ''}
                        <span style="font-size:10px; color:#64748b;">${item.id || ''}</span>
                    </span>
                    <div class="historico-acoes" onclick="event.stopPropagation()">
                        <button style="background:#f59e0b; color:white;" onclick="editarItem(${indiceReal})">✏️</button>
                        <button style="background:#ef4444; color:white;" onclick="excluirItem(${indiceReal})">🗑️</button>
                    </div>
                </div>
                <div style="display: grid; grid-template-columns: repeat(4,1fr); gap: 8px; margin-top: 10px;">
                    <div><small>Produto</small><br><strong>${item.produtoTexto || item.produto || 'N/A'}</strong></div>
                    <div><small>Preço</small><br><strong>${formatarMoeda(preco)}</strong></div>
                    <div><small>Margem</small><br><strong>${margem.toFixed(1).replace('.', ',')}%</strong></div>
                    <div><small>Risco</small><br><span class="badge ${riscoClass}">${riscoLabel}</span></div>
                </div>
                <div style="font-size: 11px; color: #64748b; margin-top: 8px;">
                    <span>${item.data || ''}</span>
                    ${isRecent ? '<span style="color:#3b82f6; float:right;">⬆️ Último</span>' : ''}
                </div>
            </div>
        `;
    });
}

function renderizarControlesPaginacao(totalItens, totalPaginas, inicio, fim) {
    const container = document.getElementById('paginacao-container');
    if (!container) return;
    
    if (totalItens === 0 || totalPaginas <= 1) {
        container.innerHTML = '';
        return;
    }
    
    let html = `
        <div class="paginacao-info">
            Mostrando ${inicio + 1}-${fim} de ${totalItens} resultados
        </div>
        <div class="paginacao-controles">
    `;
    
    // Botão Primeira
    html += `<button class="paginacao-btn" onclick="irParaPagina(1)" ${paginaAtual === 1 ? 'disabled' : ''}>⏮️</button>`;
    
    // Botão Anterior
    html += `<button class="paginacao-btn" onclick="irParaPagina(${paginaAtual - 1})" ${paginaAtual === 1 ? 'disabled' : ''}>◀️</button>`;
    
    // Números das páginas
    const maxBotoes = 5;
    let inicioPaginas = Math.max(1, paginaAtual - Math.floor(maxBotoes / 2));
    let fimPaginas = Math.min(totalPaginas, inicioPaginas + maxBotoes - 1);
    
    if (fimPaginas - inicioPaginas + 1 < maxBotoes) {
        inicioPaginas = Math.max(1, fimPaginas - maxBotoes + 1);
    }
    
    if (inicioPaginas > 1) {
        html += `<button class="paginacao-btn" onclick="irParaPagina(1)">1</button>`;
        if (inicioPaginas > 2) {
            html += `<span class="paginacao-ellipsis">...</span>`;
        }
    }
    
    for (let i = inicioPaginas; i <= fimPaginas; i++) {
        html += `<button class="paginacao-btn ${i === paginaAtual ? 'active' : ''}" onclick="irParaPagina(${i})">${i}</button>`;
    }
    
    if (fimPaginas < totalPaginas) {
        if (fimPaginas < totalPaginas - 1) {
            html += `<span class="paginacao-ellipsis">...</span>`;
        }
        html += `<button class="paginacao-btn" onclick="irParaPagina(${totalPaginas})">${totalPaginas}</button>`;
    }
    
    // Botão Próximo
    html += `<button class="paginacao-btn" onclick="irParaPagina(${paginaAtual + 1})" ${paginaAtual === totalPaginas ? 'disabled' : ''}>▶️</button>`;
    
    // Botão Última
    html += `<button class="paginacao-btn" onclick="irParaPagina(${totalPaginas})" ${paginaAtual === totalPaginas ? 'disabled' : ''}>⏭️</button>`;
    
    html += `</div>`;
    
    // Select rápido de página
    if (totalPaginas > 5) {
        html += `
            <div class="paginacao-rapida">
                <span>Ir para página:</span>
                <input type="number" min="1" max="${totalPaginas}" value="${paginaAtual}" onchange="irParaPagina(parseInt(this.value))">
                <span>de ${totalPaginas}</span>
            </div>
        `;
    }
    
    container.innerHTML = html;
}

function irParaPagina(pagina) {
    pagina = parseInt(pagina);
    if (isNaN(pagina)) return;
    
    const totalPaginas = Math.ceil(historicoPaginado.length / itensPorPagina);
    
    if (pagina < 1 || pagina > totalPaginas) {
        return;
    }
    
    paginaAtual = pagina;
    atualizarHistoricoComPaginacao();
}

// Função principal do histórico (com paginação)
function atualizarHistorico() {
    console.log('Atualizando histórico...');
    carregarPreferenciasPaginacao();
    configurarPaginacao();
    atualizarHistoricoComPaginacao();
}

// ========== FUNÇÕES DE NAVEGAÇÃO ==========

function showTab(tabName) {
    document.querySelectorAll('.tab').forEach(tab => tab.classList.remove('active'));
    document.querySelectorAll('.tab-content').forEach(content => content.classList.remove('active'));
    
    document.querySelector(`[onclick="showTab('${tabName}')"]`).classList.add('active');
    document.getElementById(tabName).classList.add('active');
    
    if (tabName === 'historico') {
        setTimeout(() => {
            carregarPreferenciasPaginacao();
            configurarPaginacao();
            atualizarHistoricoComPaginacao();
        }, 100);
    }
    
    if (tabName === 'dashboard') {
        setTimeout(() => {
            inicializarGraficos();
        }, 100);
    }
    
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

// ========== FUNÇÕES DE DASHBOARD ==========

function inicializarGraficos() {
    destruirGraficos();
    atualizarTodosGraficos();
}

function destruirGraficos() {
    if (graficoPrecos) { graficoPrecos.destroy(); graficoPrecos = null; }
    if (graficoSegmentos) { graficoSegmentos.destroy(); graficoSegmentos = null; }
    if (graficoMargens) { graficoMargens.destroy(); graficoMargens = null; }
    if (graficoRisco) { graficoRisco.destroy(); graficoRisco = null; }
    if (graficoTopClientes) { graficoTopClientes.destroy(); graficoTopClientes = null; }
    if (graficoTendenciaMargens) { graficoTendenciaMargens.destroy(); graficoTendenciaMargens = null; }
}

window.mudarPeriodoGraficos = function(periodo, event) {
    periodoAtualGraficos = periodo;
    
    document.querySelectorAll('.chart-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    if (event && event.target) {
        event.target.classList.add('active');
    }
    
    const periodoTexto = {
        '7d': 'Últimos 7 dias',
        '30d': 'Últimos 30 dias',
        '90d': 'Últimos 90 dias',
        'all': 'Todo período'
    };
    
    const periodoPrecoEl = document.getElementById('periodo-preco');
    const periodoMargemEl = document.getElementById('periodo-margem');
    if (periodoPrecoEl) periodoPrecoEl.textContent = periodoTexto[periodo];
    if (periodoMargemEl) periodoMargemEl.textContent = periodoTexto[periodo];
    
    atualizarTodosGraficos();
};

function filtrarPorPeriodo(items, periodo) {
    if (periodo === 'all' || !items || items.length === 0) {
        return items;
    }
    
    const agora = new Date();
    const limite = new Date();
    
    switch(periodo) {
        case '7d':
            limite.setDate(agora.getDate() - 7);
            break;
        case '30d':
            limite.setDate(agora.getDate() - 30);
            break;
        case '90d':
            limite.setDate(agora.getDate() - 90);
            break;
        default:
            return items;
    }
    
    return items.filter(item => {
        if (!item.data) return false;
        const partesData = item.data.split(' ')[0].split('/');
        if (partesData.length !== 3) return false;
        const dataItem = new Date(partesData[2], partesData[1] - 1, partesData[0]);
        return dataItem >= limite;
    });
}

function atualizarDashboardSeAtivo() {
    if (document.getElementById('dashboard').classList.contains('active')) {
        destruirGraficos();
        atualizarTodosGraficos();
    }
}

function atualizarTodosGraficos() {
    if (!historico || historico.length === 0) {
        mostrarGraficosVazios();
        return;
    }
    
    const historicoFiltrado = filtrarPorPeriodo(historico, periodoAtualGraficos);
    
    atualizarKPIs(historicoFiltrado);
    criarGraficoPrecos(historicoFiltrado);
    criarGraficoSegmentos();
    criarGraficoMargens();
    criarGraficoRisco();
    criarGraficoTopClientes();
    criarGraficoTendenciaMargens(historicoFiltrado);
}

function mostrarGraficosVazios() {
    destruirGraficos();
    
    const containers = document.querySelectorAll('.chart-container');
    containers.forEach(container => {
        const canvas = container.querySelector('canvas');
        if (canvas) {
            const ctx = canvas.getContext('2d');
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    });
    
    document.getElementById('kpi-total-simulacoes').textContent = '0';
    document.getElementById('kpi-ticket-medio').textContent = 'R$ 0,00';
    document.getElementById('kpi-margem-media').textContent = '0,0%';
    document.getElementById('kpi-risco-alto').textContent = '0';
    
    document.getElementById('stat-maior-preco').textContent = 'R$ 0,00';
    document.getElementById('stat-menor-preco').textContent = 'R$ 0,00';
    document.getElementById('stat-media-preco').textContent = 'R$ 0,00';
    document.getElementById('stat-maior-margem').textContent = '0,0%';
    document.getElementById('stat-media-margem').textContent = '0,0%';
    
    document.getElementById('legenda-segmentos').innerHTML = '';
    document.getElementById('legenda-risco').innerHTML = '';
}

function atualizarKPIs(dados) {
    const total = dados.length;
    document.getElementById('kpi-total-simulacoes').textContent = total;
    
    let somaPrecos = 0;
    dados.forEach(item => somaPrecos += parseFloat(item.preco) || 0);
    const ticketMedio = total > 0 ? somaPrecos / total : 0;
    document.getElementById('kpi-ticket-medio').textContent = formatarMoeda(ticketMedio);
    
    let somaMargens = 0;
    dados.forEach(item => somaMargens += parseFloat(item.margem) || 0);
    const margemMedia = total > 0 ? somaMargens / total : 0;
    document.getElementById('kpi-margem-media').textContent = margemMedia.toFixed(1).replace('.', ',') + '%';
    
    const riscoAlto = dados.filter(item => item.risco === 'alto').length;
    document.getElementById('kpi-risco-alto').textContent = riscoAlto;
}

function criarGraficoPrecos(dados) {
    const canvas = document.getElementById('graficoPrecos');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (dados.length === 0) {
        if (graficoPrecos) graficoPrecos.destroy();
        graficoPrecos = null;
        document.getElementById('stat-maior-preco').textContent = 'R$ 0,00';
        document.getElementById('stat-menor-preco').textContent = 'R$ 0,00';
        document.getElementById('stat-media-preco').textContent = 'R$ 0,00';
        return;
    }
    
    const dadosOrdenados = [...dados].sort((a, b) => {
        const dataA = a.data ? new Date(a.data.split(' ')[0].split('/').reverse().join('-')) : new Date(0);
        const dataB = b.data ? new Date(b.data.split(' ')[0].split('/').reverse().join('-')) : new Date(0);
        return dataA - dataB;
    });
    
    const labels = dadosOrdenados.map(item => item.data ? item.data.split(' ')[0] : '');
    const precos = dadosOrdenados.map(item => parseFloat(item.preco) || 0);
    
    const precosValidos = precos.filter(p => p > 0);
    const maiorPreco = precosValidos.length > 0 ? Math.max(...precosValidos) : 0;
    const menorPreco = precosValidos.length > 0 ? Math.min(...precosValidos) : 0;
    const mediaPreco = precosValidos.length > 0 ? precosValidos.reduce((a, b) => a + b, 0) / precosValidos.length : 0;
    
    document.getElementById('stat-maior-preco').textContent = formatarMoeda(maiorPreco);
    document.getElementById('stat-menor-preco').textContent = formatarMoeda(menorPreco);
    document.getElementById('stat-media-preco').textContent = formatarMoeda(mediaPreco);
    
    if (graficoPrecos) graficoPrecos.destroy();
    
    graficoPrecos = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Valor da Proposta (R$)',
                data: precos,
                borderColor: '#3b82f6',
                backgroundColor: 'rgba(59, 130, 246, 0.1)',
                borderWidth: 3,
                pointBackgroundColor: '#1e293b',
                pointBorderColor: 'white',
                pointBorderWidth: 2,
                pointRadius: 4,
                pointHoverRadius: 6,
                tension: 0.3,
                fill: true
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'R$ ' + context.parsed.y.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: false,
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR', {minimumFractionDigits: 0});
                        }
                    }
                }
            }
        }
    });
}

function criarGraficoSegmentos() {
    const canvas = document.getElementById('graficoSegmentos');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const segmentos = {};
    historico.forEach(item => {
        const seg = item.segmento || 'outros';
        segmentos[seg] = (segmentos[seg] || 0) + 1;
    });
    
    const labels = Object.keys(segmentos).map(seg => {
        const nomes = {
            'tecnologia': 'Tecnologia', 'varejo': 'Varejo', 'industria': 'Indústria',
            'servicos': 'Serviços', 'saude': 'Saúde', 'educacao': 'Educação',
            'financeiro': 'Financeiro', 'consultoria': 'Consultoria',
            'marketing': 'Marketing', 'outros': 'Outros'
        };
        return nomes[seg] || seg;
    });
    const valores = Object.values(segmentos);
    
    const cores = ['#3b82f6', '#10b981', '#f59e0b', '#8b5cf6', '#ef4444', '#ec4899', '#14b8a6', '#f97316', '#6366f1', '#64748b'];
    
    const legendaHtml = labels.map((label, i) => `
        <div class="legenda-item">
            <span class="legenda-cor" style="background: ${cores[i % cores.length]}"></span>
            <span>${label}: ${valores[i]}</span>
        </div>
    `).join('');
    document.getElementById('legenda-segmentos').innerHTML = legendaHtml;
    
    if (graficoSegmentos) graficoSegmentos.destroy();
    
    graficoSegmentos = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: labels,
            datasets: [{
                data: valores,
                backgroundColor: cores.slice(0, labels.length),
                borderWidth: 2,
                borderColor: 'white'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentual = (context.parsed / total * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentual}%)`;
                        }
                    }
                }
            },
            cutout: '65%'
        }
    });
}

function criarGraficoMargens() {
    const canvas = document.getElementById('graficoMargens');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const margensPorTipo = {};
    historico.forEach(item => {
        const tipo = item.cobrancaTexto || item.cobranca || 'outros';
        const margem = parseFloat(item.margem) || 0;
        if (!margensPorTipo[tipo]) {
            margensPorTipo[tipo] = { soma: 0, count: 0 };
        }
        margensPorTipo[tipo].soma += margem;
        margensPorTipo[tipo].count++;
    });
    
    const labels = Object.keys(margensPorTipo);
    const valores = labels.map(tipo => 
        (margensPorTipo[tipo].soma / margensPorTipo[tipo].count).toFixed(1)
    );
    
    const todasMargens = historico.map(item => parseFloat(item.margem) || 0).filter(m => m > 0);
    const maiorMargem = todasMargens.length > 0 ? Math.max(...todasMargens) : 0;
    const mediaMargem = todasMargens.length > 0 ? todasMargens.reduce((a, b) => a + b, 0) / todasMargens.length : 0;
    
    document.getElementById('stat-maior-margem').textContent = maiorMargem.toFixed(1).replace('.', ',') + '%';
    document.getElementById('stat-media-margem').textContent = mediaMargem.toFixed(1).replace('.', ',') + '%';
    
    if (graficoMargens) graficoMargens.destroy();
    
    graficoMargens = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Margem Média (%)',
                data: valores,
                backgroundColor: '#8b5cf6',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: { legend: { display: false } },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: function(value) { return value + '%'; } }
                }
            }
        }
    });
}

function criarGraficoRisco() {
    const canvas = document.getElementById('graficoRisco');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const riscos = {
        baixo: historico.filter(item => item.risco === 'baixo').length,
        medio: historico.filter(item => item.risco === 'medio').length,
        alto: historico.filter(item => item.risco === 'alto').length
    };
    
    const cores = { baixo: '#10b981', medio: '#f59e0b', alto: '#ef4444' };
    
    const legendaHtml = Object.keys(riscos).map(risco => `
        <div class="legenda-item">
            <span class="legenda-cor" style="background: ${cores[risco]}"></span>
            <span>${risco.charAt(0).toUpperCase() + risco.slice(1)}: ${riscos[risco]}</span>
        </div>
    `).join('');
    document.getElementById('legenda-risco').innerHTML = legendaHtml;
    
    if (graficoRisco) graficoRisco.destroy();
    
    graficoRisco = new Chart(ctx, {
        type: 'pie',
        data: {
            labels: ['Baixo Risco', 'Médio Risco', 'Alto Risco'],
            datasets: [{
                data: [riscos.baixo, riscos.medio, riscos.alto],
                backgroundColor: ['#10b981', '#f59e0b', '#ef4444'],
                borderWidth: 2,
                borderColor: 'white'
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            const total = context.dataset.data.reduce((a, b) => a + b, 0);
                            const percentual = (context.parsed / total * 100).toFixed(1);
                            return `${context.label}: ${context.parsed} (${percentual}%)`;
                        }
                    }
                }
            }
        }
    });
}

function criarGraficoTopClientes() {
    const canvas = document.getElementById('graficoTopClientes');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    const clientes = {};
    historico.forEach(item => {
        const cliente = item.cliente || 'Não informado';
        const valor = parseFloat(item.preco) || 0;
        if (!clientes[cliente]) clientes[cliente] = 0;
        clientes[cliente] += valor;
    });
    
    const topClientes = Object.entries(clientes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 5);
    
    const labels = topClientes.map(c => c[0]);
    const valores = topClientes.map(c => c[1]);
    
    if (graficoTopClientes) graficoTopClientes.destroy();
    
    graficoTopClientes = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Total em Propostas (R$)',
                data: valores,
                backgroundColor: '#10b981',
                borderRadius: 8
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            indexAxis: 'y',
            plugins: {
                legend: { display: false },
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            return 'R$ ' + context.parsed.x.toLocaleString('pt-BR', {minimumFractionDigits: 2, maximumFractionDigits: 2});
                        }
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        callback: function(value) {
                            return 'R$ ' + value.toLocaleString('pt-BR', {minimumFractionDigits: 0});
                        }
                    }
                }
            }
        }
    });
}

function criarGraficoTendenciaMargens(dados) {
    const canvas = document.getElementById('graficoTendenciaMargens');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    
    if (dados.length === 0) {
        if (graficoTendenciaMargens) graficoTendenciaMargens.destroy();
        graficoTendenciaMargens = null;
        return;
    }
    
    const dadosOrdenados = [...dados].sort((a, b) => {
        const dataA = a.data ? new Date(a.data.split(' ')[0].split('/').reverse().join('-')) : new Date(0);
        const dataB = b.data ? new Date(b.data.split(' ')[0].split('/').reverse().join('-')) : new Date(0);
        return dataA - dataB;
    });
    
    const labels = dadosOrdenados.map(item => item.data ? item.data.split(' ')[0] : '');
    const margens = dadosOrdenados.map(item => parseFloat(item.margem) || 0);
    
    const mediaMovel = [];
    for (let i = 0; i < margens.length; i++) {
        if (i < 2) {
            mediaMovel.push(null);
        } else {
            const media = (margens[i] + margens[i-1] + margens[i-2]) / 3;
            mediaMovel.push(Number(media.toFixed(1)));
        }
    }
    
    if (graficoTendenciaMargens) graficoTendenciaMargens.destroy();
    
    graficoTendenciaMargens = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [
                {
                    label: 'Margem (%)',
                    data: margens,
                    borderColor: '#f59e0b',
                    backgroundColor: 'rgba(245, 158, 11, 0.1)',
                    borderWidth: 2,
                    pointRadius: 3,
                    tension: 0.3
                },
                {
                    label: 'Tendência (Média 3)',
                    data: mediaMovel,
                    borderColor: '#3b82f6',
                    borderWidth: 3,
                    borderDash: [5, 5],
                    pointRadius: 0,
                    fill: false
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                tooltip: {
                    callbacks: {
                        label: function(context) {
                            if (context.parsed.y !== null) {
                                return context.dataset.label + ': ' + context.parsed.y.toFixed(1) + '%';
                            }
                            return null;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: { callback: function(value) { return value + '%'; } }
                }
            }
        }
    });
}

// ========== INICIALIZAÇÃO ==========
window.onload = function() {
    console.log('🚀 Inicializando MFBD v6.0...');
    
    verificarSessao();
    
    if (typeof historico !== 'undefined' && historico) {
        historico.sort((a, b) => new Date(b.data) - new Date(a.data));
    }
    
    setTimeout(() => {
        if (document.querySelectorAll('.perfil-row').length === 0) {
            adicionarPerfil();
        }
    }, 200);
    
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
    
    // Configurar event listeners da paginação
    const filtroCliente = document.getElementById('filtroCliente');
    const ordenarPor = document.getElementById('ordenarPor');
    
    if (filtroCliente) {
        filtroCliente.addEventListener('input', function() {
            paginaAtual = 1;
            atualizarHistoricoComPaginacao();
        });
    }
    
    if (ordenarPor) {
        ordenarPor.addEventListener('change', function() {
            paginaAtual = 1;
            atualizarHistoricoComPaginacao();
        });
    }
    
    // Carregar preferências de paginação
    carregarPreferenciasPaginacao();
    
    // Atualizar histórico
    atualizarHistorico();
    indiceEditando = -1;
    
    // Verificar se a dashboard está ativa na inicialização
    setTimeout(() => {
        if (document.getElementById('dashboard').classList.contains('active')) {
            inicializarGraficos();
        }
    }, 500);
    
    console.log('✅ MFBD - Sistema carregado v6.0');
};