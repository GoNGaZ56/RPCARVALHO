// ==========================================
// LÓGICA DO MODO ESCURO GLOAL
// ==========================================
const btnDarkMode = document.getElementById('btn-dark-mode');

// Verifica se o utilizador já tinha o modo escuro ativo antes
if(localStorage.getItem('theme') === 'dark'){
    document.body.classList.add('dark-theme');
    if(btnDarkMode){
        btnDarkMode.innerText = '☀️';
    }
}

// Ao clicar no botão, liga ou desliga e guarda a preferência
if(btnDarkMode){
    btnDarkMode.addEventListener('click', function(){
        document.body.classList.toggle('dark-theme');
        
        if(document.body.classList.contains('dark-theme')){
            localStorage.setItem('theme', 'dark');
            btnDarkMode.innerText = '☀️';
            // Se estivermos no simulador, avisa o motor 3D para escurecer o céu
            if(typeof cena !== 'undefined'){
                cena.background.setHex(0x0f172a);
            }
        }else{
            localStorage.setItem('theme', 'light');
            btnDarkMode.innerText = '🌙';
            // Se estivermos no simulador, avisa o motor 3D para clarear o céu
            if(typeof cena !== 'undefined'){
                cena.background.setHex(0x64748b);
            }
        }
    });
}

// ==========================================
// LÓGICA DA MODAL (ÁREA DE CLIENTE)
// ==========================================
function abrirModalLogin(){
    const modal = document.getElementById('modal-login');
    if(modal){
        modal.style.display = 'flex';
    }
}

function fecharModalLogin(){
    const modal = document.getElementById('modal-login');
    if(modal){
        modal.style.display = 'none';
    }
}

// Fecha a modal se o cliente clicar fora da caixa preta
window.onclick = function(evento){
    const modal = document.getElementById('modal-login');
    if(evento.target === modal){
        modal.style.display = 'none';
    }
}