/*
 * R.F. CARVALHO - Simulador Standalone V20
 * Objetivo desta versão:
 * - Layout simples e responsivo.
 * - Sem alert()/confirm() nativos.
 * - Garagem subterrânea só entra no orçamento e não destrói a geometria.
 * - Estrada sempre fora do lote e acesso sem atravessar a casa.
 * - Lote nivelado mesmo quando o terreno envolvente tem declive.
 * - Muro sempre no extremo do lote.
 * - Construções sempre colocadas dentro do lote quando existe muro/vedação.
 * - Opções avançadas escondidas até serem necessárias.
 */
const App = (function(){
    'use strict';

    let cena = null;
    let camara = null;
    let renderizador = null;
    let controlos = null;
    let grupoMundo = new THREE.Group();
    let grupoLote = new THREE.Group();
    let grupoConstrucao = new THREE.Group();
    let grupoManuais = new THREE.Group();
    let grupoPreview = new THREE.Group();
    let terrenoMesh = null;
    let loteMesh = null;
    let luzSol = null;
    let luzHemi = null;
    let materiais = {};
    let ferramentaAtual = null;
    let raycaster = new THREE.Raycaster();
    let rato = new THREE.Vector2();
    let frames = 0;
    let ultimoFPS = performance.now();
    let ultimoCfg = null;
    let ultimaEstimativa = 0;
    let bootConcluido = false;
    let avisoEspacoAssinatura = '';
    let objetosOcupados = [];
    let manuais = [];
    let ultimoPontoPreview = null;
    let ultimoPontoTerreno = null;
    let rotacoesFerramenta = {};
    let offsetColocacao = {x:0, z:0, y:0};
    let categoriaFerramentaAtual = null;

    const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 900;
    const QUALITY = isMobile ? 'mobile' : 'desktop';

    function $(id){ return document.getElementById(id); }
    function qsa(sel){ return Array.prototype.slice.call(document.querySelectorAll(sel)); }
    function clamp(v, min, max){ return Math.max(min, Math.min(max, v)); }
    function deg(v){ return v * Math.PI / 180; }
    function fmtEUR(v){ return (v || 0).toLocaleString('pt-PT', {style:'currency', currency:'EUR'}); }
    function fmtM2(v){ return Math.round(v || 0).toLocaleString('pt-PT') + ' m²'; }
    function safeNumber(id, def, min, max){
        const el = $(id);
        let v = el ? parseFloat(String(el.value).replace(',', '.')) : def;
        if(!isFinite(v)){ v = def; }
        v = clamp(v, min, max);
        if(el && String(el.value) !== String(v)){ el.value = v; }
        return v;
    }
    function safeInt(id, def, min, max){ return Math.round(safeNumber(id, def, min, max)); }
    function safeValue(id, def){ const el = $(id); return el ? el.value : def; }
    function safeBool(id, def){
        const el = $(id);
        if(!el){ return !!def; }
        if(el.type === 'checkbox'){ return !!el.checked; }
        return el.value === '1' || el.value === 'true' || el.value === true;
    }

    function setValueIfExists(id, value){
        const el = $(id);
        if(el){ el.value = value; }
    }

    function getCfgNum(cfg, prop, def){
        const v = cfg && isFinite(cfg[prop]) ? Number(cfg[prop]) : def;
        return isFinite(v) ? v : def;
    }

    function log(msg, tipo){
        const target = $('console-logs');
        if(!target){ return; }
        const d = new Date();
        const t = d.getHours().toString().padStart(2,'0') + ':' + d.getMinutes().toString().padStart(2,'0') + ':' + d.getSeconds().toString().padStart(2,'0');
        const linha = document.createElement('div');
        linha.className = 'console-line';
        let classe = 'console-sys';
        if(tipo === 'warn'){ classe = 'console-warn'; }
        if(tipo === 'err'){ classe = 'console-err'; }
        linha.innerHTML = '<span class="console-time">[' + t + ']</span> <span class="' + classe + '">&gt; ' + escapeHTML(msg) + '</span>';
        target.appendChild(linha);
        target.scrollTop = target.scrollHeight;
        while(target.children.length > 80){ target.removeChild(target.firstChild); }
    }

    function escapeHTML(txt){
        return String(txt == null ? '' : txt)
            .replace(/&/g,'&amp;')
            .replace(/</g,'&lt;')
            .replace(/>/g,'&gt;')
            .replace(/"/g,'&quot;')
            .replace(/'/g,'&#039;');
    }

    function mostrarModal(titulo, mensagem, botoes){
        const modal = $('modal-sistema');
        if(!modal){ return; }
        const listaBotoes = botoes && botoes.length ? botoes : [{texto:'OK', tipo:'primary'}];
        modal.innerHTML = '';
        const content = document.createElement('div');
        content.className = 'modal-content';
        const btnHtml = listaBotoes.map(function(b, i){
            return '<button type="button" class="btn-modal ' + (b.tipo === 'primary' ? 'primary' : '') + '" data-idx="' + i + '">' + escapeHTML(b.texto) + '</button>';
        }).join('');
        content.innerHTML =
            '<div class="modal-header"><h2>' + escapeHTML(titulo) + '</h2><button type="button" class="btn-close" data-close="1">×</button></div>' +
            '<div class="modal-body"><p class="modal-message">' + escapeHTML(mensagem) + '</p><div class="modal-actions">' + btnHtml + '</div></div>';
        modal.appendChild(content);
        modal.classList.add('ativo');
        content.querySelector('[data-close]').addEventListener('click', function(){ modal.classList.remove('ativo'); });
        content.querySelectorAll('[data-idx]').forEach(function(btn){
            btn.addEventListener('click', function(){
                const idx = parseInt(btn.getAttribute('data-idx'), 10);
                const acao = listaBotoes[idx] && listaBotoes[idx].acao;
                modal.classList.remove('ativo');
                if(typeof acao === 'function'){ acao(); }
            });
        });
    }

    function mostrarTermos(){
        mostrarModal('Termos de responsabilidade',
            'Esta ferramenta é apenas uma simulação visual e financeira preliminar.\n\n' +
            'Os valores apresentados não substituem medições reais, projeto de arquitetura, projeto de estabilidade, especialidades, licenciamento, estudo geotécnico, visita técnica, proposta comercial formal ou validação por técnico habilitado.\n\n' +
            'Ao usar o simulador, o utilizador aceita que a estimativa serve apenas para orientação inicial.',
            [{texto:'Compreendi', tipo:'primary'}]
        );
    }

    function mostrarAjuda(){
        mostrarModal('Ajuda do simulador',
            '1. Defina primeiro a área do terreno e a posição da casa.\n' +
            '2. Ative apenas os elementos que quer simular. As opções avançadas aparecem automaticamente.\n' +
            '3. A estrada fica fora do lote e apenas cria uma entrada curta para o portão/casa.\n' +
            '4. A garagem subterrânea apenas entra na estimativa, sem alterar o terreno visual.\n' +
            '5. Para adicionar árvore, planta, deck, pérgola, churrasqueira, candeeiro ou pedra, carregue no botão lápis dentro do 3D e clique no lote.\n' +
            '6. Para mover a piscina livremente, ative a piscina, escolha o lápis no 3D e selecione Mover piscina.\n' +
            '7. Para relatório, aceite os termos de responsabilidade.',
            [{texto:'OK', tipo:'primary'}]
        );
    }

    function initTema(){
        const btn = $('btn-dark-mode');
        const tema = localStorage.getItem('rfTema') || 'dark';
        if(tema === 'dark'){ document.body.classList.add('dark-theme'); }
        if(btn){
            btn.addEventListener('click', function(){
                document.body.classList.toggle('dark-theme');
                localStorage.setItem('rfTema', document.body.classList.contains('dark-theme') ? 'dark' : 'light');
            });
        }
    }

    function aplicarVisibilidadeCondicional(){
        qsa('.conditional[data-show-when]').forEach(function(bloco){
            const rule = bloco.getAttribute('data-show-when') || '';
            const parts = rule.split(':');
            if(parts.length !== 2){ bloco.classList.add('is-visible'); return; }
            const id = parts[0];
            const allowed = parts[1].split(',').map(function(x){ return x.trim(); });
            const el = $(id);
            let actual = '';
            if(!el){ actual = ''; }
            else if(el.type === 'checkbox'){ actual = el.checked ? 'true' : 'false'; }
            else{ actual = el.value; }
            bloco.classList.toggle('is-visible', allowed.indexOf(actual) >= 0);
        });
    }

    function lerCfg(){
        const mode = document.body.getAttribute('data-mode') || 'pro';
        const isSimples = mode === 'simples';
        const cfg = {
            mode: mode,
            terreno: isSimples ? 'normal' : safeValue('terreno', 'normal'),
            areaTerreno: isSimples ? 850 : safeNumber('area-terreno', 900, 350, 20000),
            formatoTerreno: isSimples ? 'irregular' : safeValue('formato-terreno', 'irregular'),
            posicaoCasa: isSimples ? 'central' : safeValue('posicao-casa', 'central'),
            estrada: isSimples ? 'frente' : safeValue('estrada', 'frente'),
            entradaLote: isSimples ? 'alinhada' : safeValue('entrada-lote', 'alinhada'),
            tipoMuro: isSimples ? 'nenhum' : safeValue('tipo-muro', 'nenhum'),
            tracadoMuro: isSimples ? 'reto' : safeValue('tracado-muro', 'reto'),
            areaMuro: isSimples ? 0 : safeNumber('area-muro', 0, 0, 20000),
            tipoPlanta: isSimples ? 'nenhuma' : safeValue('tipo-planta', 'nenhuma'),
            densidadeArvores: isSimples ? 'baixa' : safeValue('densidade-arvores', 'baixa'),
            tipo: safeValue('tipo', 'moradia'),
            estiloCasa: safeValue('estilo-casa', 'moderno'),
            formatoCasa: safeValue('formato-casa', 'retangular'),
            formatoLarguraL: safeNumber('formato-l-largura', 38, 20, 85),
            formatoProfundidadeL: safeNumber('formato-l-profundidade', 42, 20, 95),
            formatoLarguraU: safeNumber('formato-u-largura', 28, 18, 55),
            formatoProfundidadeU: safeNumber('formato-u-profundidade', 48, 22, 95),
            formatoAberturaU: safeNumber('formato-u-abertura', 40, 18, 70),
            personalizarPisos: safeBool('personalizar-pisos', false),
            paredeFrente: safeValue('parede-frente', 'auto'),
            paredeTras: safeValue('parede-tras', 'auto'),
            paredeEsq: safeValue('parede-esq', 'auto'),
            paredeDir: safeValue('parede-dir', 'auto'),
            piso1Largura: safeNumber('piso1-largura', 100, 55, 130),
            piso1Profundidade: safeNumber('piso1-profundidade', 100, 55, 130),
            piso2Largura: safeNumber('piso2-largura', 92, 45, 130),
            piso2Profundidade: safeNumber('piso2-profundidade', 92, 45, 130),
            piso3Largura: safeNumber('piso3-largura', 85, 40, 130),
            piso3Profundidade: safeNumber('piso3-profundidade', 85, 40, 130),
            area: safeNumber('area', 120, 45, 2500),
            andares: safeInt('andares', 1, 1, 12),
            vivendasQtd: safeInt('vivendas-qtd', 2, 2, 8),
            vivendasDisposicao: safeValue('vivendas-disposicao', 'geminadas'),
            garagem: safeValue('garagem', 'nenhuma'),
            garagemPortoes: safeInt('garagem-portoes', 1, 1, 4),
            garagemPortaLateral: safeBool('garagem-porta-lateral', true),
            garagemTelhado: safeValue('garagem-telhado', 'uma_agua'),
            telhado: safeValue('telhado', 'plano'),
            orientacaoTelhado: safeValue('orientacao-telhado', 'frente_tras'),
            inclinacaoTelhado: safeValue('inclinacao-telhado', 'media'),
            claraboias: safeInt('claraboia', 0, 0, 3),
            paineis: safeBool('paineis-solares', false),
            anexos: isSimples ? 'nenhum' : safeValue('anexos', 'nenhum'),
            posicaoAnexo: safeValue('posicao-anexo', 'direita'),
            portasAnexo: safeInt('portas-anexo', 1, 0, 4),
            anexoLargura: safeNumber('anexo-largura', 0, 0, 30),
            anexoProfundidade: safeNumber('anexo-profundidade', 0, 0, 25),
            garagemAnexoPortoes: safeInt('garagem-anexo-portoes', 1, 1, 4),
            anexoTelhado: safeValue('anexo-telhado', 'uma_agua'),
            anexoManual: safeValue('anexo-manual', '0') === '1',
            anexoX: safeNumber('anexo-x', 0, -10000, 10000),
            anexoZ: safeNumber('anexo-z', 0, -10000, 10000),
            piscina: safeBool('piscina', false),
            posicaoPiscina: safeValue('posicao-piscina', 'tras'),
            piscinaComprimento: safeNumber('piscina-comprimento', 8, 4, 30),
            piscinaLargura: safeNumber('piscina-largura', 4, 2.5, 15),
            piscinaManual: safeValue('piscina-manual', '0') === '1',
            piscinaX: safeNumber('piscina-x', 0, -10000, 10000),
            piscinaZ: safeNumber('piscina-z', 0, -10000, 10000),
            climatizacao: safeValue('climatizacao', 'nenhuma'),
            varandaLargura: safeNumber('varanda-largura', 3.2, 1.6, 10),
            varandaProfundidade: safeNumber('varanda-profundidade', 1.35, .7, 3.5),
            anexoExtraLargura: safeNumber('anexo-extra-largura', 6.0, 2.5, 30),
            anexoExtraProfundidade: safeNumber('anexo-extra-profundidade', 4.2, 2.5, 25),
            anexoExtraAltura: safeNumber('anexo-extra-altura', 2.75, 2.1, 4.5),
            anexoExtraTelhado: safeValue('anexo-extra-telhado', 'uma_agua'),
            pavimentoLargura: safeNumber('pavimento-largura', 5.0, 1, 25),
            pavimentoProfundidade: safeNumber('pavimento-profundidade', 3.0, 1, 25),
            caminhoLargura: safeNumber('caminho-largura', 1.4, .6, 5),
            caminhoComprimento: safeNumber('caminho-comprimento', 6.0, 1, 35),
            pergolaLargura: safeNumber('pergola-largura', 4.8, 2, 14),
            pergolaProfundidade: safeNumber('pergola-profundidade', 3.3, 2, 10),
            pergolaAltura: safeNumber('pergola-altura', 2.45, 2, 4),
            deckLargura: safeNumber('deck-largura', 5.2, 2, 18),
            deckProfundidade: safeNumber('deck-profundidade', 3.2, 2, 14),
            churrascoLargura: safeNumber('churrasco-largura', 3.6, 2.5, 12),
            churrascoProfundidade: safeNumber('churrasco-profundidade', 2.5, 2, 10),
            assimetria: safeBool('assimetria', false)
        };
        if(cfg.tipo === 'vivenda'){
            cfg.andares = clamp(cfg.andares, 1, 3);
            const el = $('andares');
            if(el && parseInt(el.value,10) !== cfg.andares){ el.value = cfg.andares; }
        }
        return cfg;
    }

    function areaTotalConstrucao(cfg){
        const unidades = cfg.tipo === 'vivenda' ? cfg.vivendasQtd : 1;
        return cfg.area * cfg.andares * unidades;
    }

    function loteDimensoes(cfg){
        const area = Math.max(350, cfg.areaTerreno || 900);
        const ratio = 1.32;
        let w = Math.sqrt(area * ratio);
        let d = area / w;
        if(w < 26){ w = 26; d = area / w; }
        if(d < 22){ d = 22; w = area / d; }
        return {w:w, d:d};
    }

    function footprintUnidade(cfg){
        if(cfg.tipo === 'predio'){
            const w = Math.sqrt(cfg.area * 1.05);
            return {w:w, d:cfg.area / w, h:3.15};
        }
        const w = Math.sqrt(cfg.area * 1.2);
        return {w:w, d:cfg.area / w, h:3.05};
    }

    function footprintPrincipal(cfg){
        const u = footprintUnidade(cfg);
        if(cfg.tipo !== 'vivenda'){ return {w:u.w, d:u.d, unitW:u.w, unitD:u.d, unidades:1}; }
        const gap = cfg.vivendasDisposicao === 'separadas' ? 2.4 : 0.16;
        const w = cfg.vivendasQtd * u.w + (cfg.vivendasQtd - 1) * gap;
        return {w:w, d:u.d, unitW:u.w, unitD:u.d, unidades:cfg.vivendasQtd, gap:gap};
    }

    function posicaoCasaNoLote(cfg, lote, fp){
        const margen = 4.5;
        const maxX = Math.max(0, lote.w/2 - fp.w/2 - margen);
        const maxZ = Math.max(0, lote.d/2 - fp.d/2 - margen);
        let x = 0;
        let z = 0;
        if(cfg.posicaoCasa === 'frente'){ z = maxZ * 0.72; }
        if(cfg.posicaoCasa === 'tras'){ z = -maxZ * 0.72; }
        if(cfg.posicaoCasa === 'esquerda'){ x = -maxX * 0.72; }
        if(cfg.posicaoCasa === 'direita'){ x = maxX * 0.72; }
        return {x:x, z:z};
    }

    function rect(name, x, z, w, d){
        return {name:name, x:x, z:z, w:w, d:d, minX:x-w/2, maxX:x+w/2, minZ:z-d/2, maxZ:z+d/2};
    }

    function intersectRect(a, b, margin){
        const m = margin || 0;
        return !(a.maxX + m < b.minX || a.minX - m > b.maxX || a.maxZ + m < b.minZ || a.minZ - m > b.maxZ);
    }

    function lotePontos(cfg, lote){
        const hw = lote.w / 2;
        const hd = lote.d / 2;
        const formato = (cfg && cfg.formatoTerreno) || 'irregular';
        if(formato === 'retangular'){
            return [{x:-hw,z:-hd},{x:hw,z:-hd},{x:hw,z:hd},{x:-hw,z:hd}];
        }
        if(formato === 'trapezio'){
            return [{x:-hw*.92,z:-hd},{x:hw*.82,z:-hd},{x:hw,z:hd},{x:-hw*.72,z:hd}];
        }
        // Lote irregular suave: continua tecnicamente simples mas deixa de parecer um retângulo obrigatório.
        return [
            {x:-hw*.92,z:-hd*.94},
            {x: hw*.84,z:-hd},
            {x: hw*.98,z:-hd*.18},
            {x: hw*.88,z: hd*.88},
            {x: hw*.18,z: hd},
            {x:-hw*.96,z: hd*.82},
            {x:-hw,z: hd*.08}
        ];
    }

    function pontoEmPoligono(x, z, pontos){
        let dentro = false;
        for(let i=0, j=pontos.length-1; i<pontos.length; j=i++){
            const xi = pontos[i].x, zi = pontos[i].z;
            const xj = pontos[j].x, zj = pontos[j].z;
            const intersecta = ((zi > z) !== (zj > z)) && (x < (xj - xi) * (z - zi) / ((zj - zi) || 0.000001) + xi);
            if(intersecta){ dentro = !dentro; }
        }
        return dentro;
    }

    function pontoDentroLotePoligono(x, z, lote, margin){
        const cfg = ultimoCfg || lerCfg();
        const pontos = lotePontos(cfg, lote);
        if(!pontoEmPoligono(x, z, pontos)){ return false; }
        const m = margin || 0;
        if(x < -lote.w/2 + m || x > lote.w/2 - m || z < -lote.d/2 + m || z > lote.d/2 - m){ return false; }
        return true;
    }

    function insideLotRect(r, lote, margin){
        const m = margin || 0;
        const corners = [
            {x:r.minX-m,z:r.minZ-m},{x:r.maxX+m,z:r.minZ-m},
            {x:r.maxX+m,z:r.maxZ+m},{x:r.minX-m,z:r.maxZ+m}
        ];
        for(let i=0;i<corners.length;i++){
            if(!pontoDentroLotePoligono(corners[i].x, corners[i].z, lote, 0)){ return false; }
        }
        return true;
    }

    function alturaTerreno(x, z, cfg){
        const lote = loteDimensoes(cfg);
        const insideFlatLot = Math.abs(x) <= lote.w/2 + 0.4 && Math.abs(z) <= lote.d/2 + 0.4;
        if(insideFlatLot){ return 0; }
        if(cfg.terreno === 'normal'){ return 0; }
        const slope = cfg.terreno === 'montanha' ? 0.12 : 0.055;
        const wave = cfg.terreno === 'montanha' ? 0.45 : 0.18;
        let y = z * slope + Math.sin(x * 0.08) * wave + Math.cos(z * 0.06) * wave;
        const distX = Math.max(0, Math.abs(x) - lote.w/2);
        const distZ = Math.max(0, Math.abs(z) - lote.d/2);
        const dist = Math.sqrt(distX*distX + distZ*distZ);
        const blend = clamp(dist / 12, 0, 1);
        return y * blend;
    }

    function criarTexturaCanvas(tipo, w, h){
        const canvas = document.createElement('canvas');
        canvas.width = w || 512;
        canvas.height = h || 512;
        const ctx = canvas.getContext('2d');
        function noise(alpha){
            const img = ctx.getImageData(0,0,canvas.width,canvas.height);
            for(let i=0;i<img.data.length;i+=4){
                const v = Math.floor((Math.random() - 0.5) * 40);
                img.data[i] = clamp(img.data[i] + v,0,255);
                img.data[i+1] = clamp(img.data[i+1] + v,0,255);
                img.data[i+2] = clamp(img.data[i+2] + v,0,255);
                img.data[i+3] = alpha || 255;
            }
            ctx.putImageData(img,0,0);
        }
        if(tipo === 'parede'){
            ctx.fillStyle = '#f0f1ec'; ctx.fillRect(0,0,canvas.width,canvas.height);
            noise(255);
            ctx.globalAlpha = .14;
            for(let i=0;i<140;i++){ ctx.fillStyle = i % 2 ? '#ffffff' : '#c9d1c9'; ctx.beginPath(); ctx.arc(Math.random()*canvas.width, Math.random()*canvas.height, Math.random()*1.5, 0, Math.PI*2); ctx.fill(); }
            ctx.globalAlpha = 1;
        }else if(tipo === 'telha'){
            const grad = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
            grad.addColorStop(0,'#c87338'); grad.addColorStop(.5,'#e0a06a'); grad.addColorStop(1,'#9a461f');
            ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width,canvas.height);
            for(let y=0;y<canvas.height;y+=55){
                ctx.fillStyle = 'rgba(255,255,255,.13)'; ctx.fillRect(0,y,canvas.width,4);
                ctx.fillStyle = 'rgba(80,32,10,.18)'; ctx.fillRect(0,y+44,canvas.width,5);
            }
            for(let x=0;x<canvas.width;x+=62){
                ctx.strokeStyle = 'rgba(80,32,10,.18)'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x+35,canvas.height); ctx.stroke();
            }
            noise(255);
        }else if(tipo === 'betao'){
            ctx.fillStyle = '#b9c2b8'; ctx.fillRect(0,0,canvas.width,canvas.height);
            noise(255);
            ctx.strokeStyle = 'rgba(90,100,90,.15)'; ctx.lineWidth = 2;
            for(let i=0;i<8;i++){ ctx.beginPath(); ctx.moveTo(0,Math.random()*canvas.height); ctx.bezierCurveTo(150,Math.random()*canvas.height,300,Math.random()*canvas.height,canvas.width,Math.random()*canvas.height); ctx.stroke(); }
        }else if(tipo === 'madeira'){
            ctx.fillStyle = '#8a552b'; ctx.fillRect(0,0,canvas.width,canvas.height);
            for(let x=0;x<canvas.width;x+=12){
                ctx.fillStyle = x%24===0 ? '#6d3e1c' : '#a56a38';
                ctx.fillRect(x,0,Math.random()*8+5,canvas.height);
            }
            for(let y=20;y<canvas.height;y+=80){ ctx.strokeStyle='rgba(30,15,5,.22)'; ctx.beginPath(); ctx.moveTo(0,y); ctx.bezierCurveTo(130,y+20,230,y-20,canvas.width,y+10); ctx.stroke(); }
        }else if(tipo === 'portao'){
            ctx.fillStyle = '#cfd8d2'; ctx.fillRect(0,0,canvas.width,canvas.height);
            for(let y=0;y<canvas.height;y+=48){
                ctx.fillStyle = y%96===0 ? '#dbe4df' : '#bfc8c2'; ctx.fillRect(0,y,canvas.width,42);
                ctx.fillStyle = '#7e8a84'; ctx.fillRect(0,y+42,canvas.width,6);
            }
            ctx.strokeStyle='rgba(20,30,25,.35)';ctx.lineWidth=8;ctx.strokeRect(8,8,canvas.width-16,canvas.height-16);
        }else if(tipo === 'janela'){
            const grad = ctx.createLinearGradient(0,0,canvas.width,canvas.height);
            grad.addColorStop(0,'#e6fff0'); grad.addColorStop(.35,'#92e6b0'); grad.addColorStop(1,'#22543d');
            ctx.fillStyle = grad; ctx.fillRect(0,0,canvas.width,canvas.height);
            ctx.fillStyle='rgba(255,255,255,.35)'; ctx.beginPath(); ctx.moveTo(0,canvas.height); ctx.lineTo(canvas.width*.55,0); ctx.lineTo(canvas.width*.72,0); ctx.lineTo(canvas.width*.18,canvas.height); ctx.fill();
            ctx.strokeStyle='#183c29'; ctx.lineWidth=30; ctx.strokeRect(15,15,canvas.width-30,canvas.height-30);
            ctx.lineWidth=18; ctx.beginPath(); ctx.moveTo(canvas.width/2,15); ctx.lineTo(canvas.width/2,canvas.height-15); ctx.moveTo(15,canvas.height/2); ctx.lineTo(canvas.width-15,canvas.height/2); ctx.stroke();
        }else if(tipo === 'relva'){
            ctx.fillStyle = '#b7dcc5'; ctx.fillRect(0,0,canvas.width,canvas.height);
            for(let i=0;i<900;i++){ ctx.fillStyle = Math.random()>.5 ? 'rgba(90,160,105,.13)' : 'rgba(255,255,255,.08)'; ctx.fillRect(Math.random()*canvas.width, Math.random()*canvas.height, Math.random()*5+1, Math.random()*5+1); }
        }else if(tipo === 'asfalto'){
            ctx.fillStyle = '#080d0a'; ctx.fillRect(0,0,canvas.width,canvas.height);
            noise(255);
            for(let y=0;y<canvas.height;y+=64){ ctx.fillStyle='rgba(255,255,255,.045)'; ctx.fillRect(0,y,canvas.width,3); }
        }
        const tex = new THREE.CanvasTexture(canvas);
        tex.wrapS = THREE.RepeatWrapping;
        tex.wrapT = THREE.RepeatWrapping;
        tex.anisotropy = QUALITY === 'mobile' ? 1 : 4;
        return tex;
    }

    function criarMateriais(){
        const paredeTex = criarTexturaCanvas('parede'); paredeTex.repeat.set(2,2);
        const telhaTex = criarTexturaCanvas('telha'); telhaTex.repeat.set(2,2);
        const betaoTex = criarTexturaCanvas('betao'); betaoTex.repeat.set(2,2);
        const relvaTex = criarTexturaCanvas('relva'); relvaTex.repeat.set(4,4);
        const asfaltoTex = criarTexturaCanvas('asfalto'); asfaltoTex.repeat.set(1,8);
        const madeiraTex = criarTexturaCanvas('madeira'); madeiraTex.repeat.set(1,1);
        const portaoTex = criarTexturaCanvas('portao');
        const janelaTex = criarTexturaCanvas('janela');
        materiais.parede = new THREE.MeshStandardMaterial({map:paredeTex, roughness:.78, metalness:.02});
        materiais.paredeModerna = materiais.parede;
        materiais.paredeTradicional = new THREE.MeshStandardMaterial({map:paredeTex, color:0xf3ead8, roughness:.82, metalness:.01});
        materiais.paredeRustica = new THREE.MeshStandardMaterial({map:betaoTex, color:0xd6c6aa, roughness:.92, metalness:0});
        materiais.fachadaReboco = new THREE.MeshStandardMaterial({map:paredeTex, color:0xf6faf5, roughness:.78, metalness:.01});
        materiais.fachadaPedra = new THREE.MeshStandardMaterial({map:betaoTex, color:0xb8b09f, roughness:.95, metalness:0});
        materiais.fachadaMadeira = new THREE.MeshStandardMaterial({map:madeiraTex, color:0xc38345, roughness:.82, metalness:0});
        materiais.telheado = new THREE.MeshStandardMaterial({map:telhaTex, roughness:.72, metalness:.02, side:THREE.DoubleSide});
        materiais.telheadoEscuro = new THREE.MeshStandardMaterial({color:0x475569, map:betaoTex, roughness:.75, side:THREE.DoubleSide});
        materiais.betao = new THREE.MeshStandardMaterial({map:betaoTex, roughness:.9});
        materiais.relva = new THREE.MeshStandardMaterial({map:relvaTex, color:0xb7dcc5, roughness:1});
        materiais.asfalto = new THREE.MeshStandardMaterial({map:asfaltoTex, roughness:.95});
        materiais.madeira = new THREE.MeshStandardMaterial({map:madeiraTex, roughness:.8});
        materiais.porta = new THREE.MeshStandardMaterial({map:madeiraTex, roughness:.62});
        materiais.portao = new THREE.MeshStandardMaterial({map:portaoTex, roughness:.72, metalness:.05});
        materiais.janela = new THREE.MeshStandardMaterial({map:janelaTex, roughness:.2, metalness:.25});
        materiais.vidro = new THREE.MeshStandardMaterial({color:0xa7f3d0, roughness:.08, metalness:.1, transparent:true, opacity:.78});
        materiais.claraboia = new THREE.MeshStandardMaterial({color:0xbfffe0, roughness:.08, metalness:.12, transparent:true, opacity:.92, emissive:0x0b5d38, emissiveIntensity:.12});
        materiais.agua = new THREE.MeshStandardMaterial({color:0x38bdf8, transparent:true, opacity:.72, roughness:.05, metalness:.02});
        materiais.sebe = new THREE.MeshStandardMaterial({color:0x0f6b34, roughness:1});
        materiais.tronco = new THREE.MeshStandardMaterial({color:0x6b3f22, roughness:.9});
        materiais.folha = new THREE.MeshStandardMaterial({color:0x0d6b35, roughness:.9});
        materiais.linha = new THREE.LineBasicMaterial({color:0x22c55e, transparent:true, opacity:.55});
        materiais.preto = new THREE.MeshStandardMaterial({color:0x050706, roughness:.82});
        materiais.pedra = new THREE.MeshStandardMaterial({color:0x9ca3af, roughness:.9});
        materiais.solar = new THREE.MeshStandardMaterial({color:0x050a0f, roughness:.3, metalness:.6});
        materiais.previewOk = new THREE.MeshStandardMaterial({color:0x22c55e, transparent:true, opacity:.38, roughness:.5, depthWrite:false});
        materiais.previewBad = new THREE.MeshStandardMaterial({color:0xef4444, transparent:true, opacity:.42, roughness:.5, depthWrite:false});
        materiais.fachadaVidro = new THREE.MeshStandardMaterial({color:0x9ff5c5, transparent:true, opacity:.55, roughness:.12, metalness:.15});
        materiais.carro = new THREE.MeshStandardMaterial({color:0x1f2937, roughness:.45, metalness:.25});
        materiais.chafariz = new THREE.MeshStandardMaterial({color:0xb8c4bd, roughness:.72, metalness:.04});
    }

    function disposeGroup(group){
        while(group.children.length){
            const obj = group.children[0];
            if(obj.geometry){ obj.geometry.dispose(); }
            if(obj.material && Array.isArray(obj.material)){ obj.material.forEach(function(m){ if(m.dispose){ m.dispose(); } }); }
            group.remove(obj);
        }
    }

    function initThree(){
        const holder = $('canvas-container');
        if(!holder || typeof THREE === 'undefined'){
            mostrarModal('Erro', 'O motor 3D não conseguiu arrancar. Verifique se o Three.js carregou corretamente.', [{texto:'OK', tipo:'primary'}]);
            return false;
        }
        cena = new THREE.Scene();
        cena.background = new THREE.Color(0x06140b);
        cena.fog = new THREE.Fog(0x06140b, 60, 220);
        cena.add(grupoMundo);
        cena.add(grupoLote);
        cena.add(grupoConstrucao);
        cena.add(grupoManuais);
        cena.add(grupoPreview);

        camara = new THREE.PerspectiveCamera(45, Math.max(1, holder.clientWidth) / Math.max(1, holder.clientHeight), .1, 800);
        camara.position.set(35, 32, 42);

        renderizador = new THREE.WebGLRenderer({antialias:QUALITY !== 'mobile', alpha:false, preserveDrawingBuffer:true, powerPreference:'high-performance'});
        renderizador.setPixelRatio(Math.min(window.devicePixelRatio || 1, QUALITY === 'mobile' ? 1.25 : 1.8));
        renderizador.setSize(holder.clientWidth, holder.clientHeight);
        renderizador.shadowMap.enabled = QUALITY !== 'mobile';
        renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
        holder.innerHTML = '';
        holder.appendChild(renderizador.domElement);

        luzHemi = new THREE.HemisphereLight(0xeafff0, 0x263326, .82);
        luzHemi.position.set(0, 90, 0);
        cena.add(luzHemi);
        luzSol = new THREE.DirectionalLight(0xffffff, 1.25);
        luzSol.position.set(50, 70, 42);
        luzSol.castShadow = QUALITY !== 'mobile';
        if(luzSol.castShadow){
            luzSol.shadow.mapSize.width = 2048;
            luzSol.shadow.mapSize.height = 2048;
            luzSol.shadow.camera.left = -70;
            luzSol.shadow.camera.right = 70;
            luzSol.shadow.camera.top = 70;
            luzSol.shadow.camera.bottom = -70;
        }
        cena.add(luzSol);

        controlos = new THREE.OrbitControls(camara, renderizador.domElement);
        controlos.enableDamping = true;
        controlos.dampingFactor = .08;
        controlos.maxPolarAngle = Math.PI / 2 - 0.02;
        controlos.minDistance = 12;
        controlos.maxDistance = 150;
        controlos.target.set(0, 0, 0);

        holder.addEventListener('pointerdown', onPointerDown, false);
        holder.addEventListener('pointermove', onPointerMove, false);
        holder.addEventListener('pointerleave', limparPreview, false);
        holder.addEventListener('wheel', onWheelFerramenta, {passive:true});
        window.addEventListener('keydown', onKeyFerramenta, false);
        window.addEventListener('resize', onResize, false);
        return true;
    }

    function criarPlanoSubdividido(w, d, segX, segZ, material, yFunc){
        const geo = new THREE.PlaneGeometry(w, d, segX, segZ);
        geo.rotateX(-Math.PI / 2);
        const pos = geo.attributes.position;
        for(let i=0; i<pos.count; i++){
            const x = pos.getX(i);
            const z = pos.getZ(i);
            pos.setY(i, yFunc ? yFunc(x,z) : 0);
        }
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, material);
        mesh.receiveShadow = true;
        return mesh;
    }

    function criarTerreno(cfg){
        disposeGroup(grupoMundo);
        const lote = loteDimensoes(cfg);
        const worldW = Math.max(70, lote.w + 56);
        const worldD = Math.max(62, lote.d + 52);
        const seg = QUALITY === 'mobile' ? 32 : 54;
        terrenoMesh = criarPlanoSubdividido(worldW, worldD, seg, seg, materiais.relva, function(x,z){ return alturaTerreno(x,z,cfg); });
        terrenoMesh.name = 'terreno';
        grupoMundo.add(terrenoMesh);
        criarEstrada(cfg, lote, worldW, worldD);
        criarVegetacaoAutomatica(cfg, lote, worldW, worldD);
    }

    function criarLote(cfg){
        disposeGroup(grupoLote);
        objetosOcupados = [];
        const lote = loteDimensoes(cfg);
        const pontos = lotePontos(cfg, lote);
        const shape = new THREE.Shape();
        pontos.forEach(function(p, idx){
            if(idx === 0){ shape.moveTo(p.x, p.z); }
            else{ shape.lineTo(p.x, p.z); }
        });
        shape.closePath();
        const geo = new THREE.ShapeGeometry(shape);
        geo.rotateX(-Math.PI / 2);
        loteMesh = new THREE.Mesh(geo, materiais.relva);
        loteMesh.position.y = 0.018;
        loteMesh.receiveShadow = true;
        loteMesh.name = 'lote';
        grupoLote.add(loteMesh);
        criarLinhasLote(lote);
        criarMuro(cfg, lote);
        return lote;
    }

    function criarLinhasLote(lote){
        const cfg = ultimoCfg || lerCfg();
        const ptsRaw = lotePontos(cfg, lote);
        const pts = ptsRaw.concat([ptsRaw[0]]).map(function(p){ return new THREE.Vector3(p.x, .055, p.z); });
        const geo = new THREE.BufferGeometry().setFromPoints(pts);
        const ln = new THREE.Line(geo, materiais.linha);
        grupoLote.add(ln);

        // linhas técnicas discretas, cortadas ao centro para orientar o utilizador
        const eixoX = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(-lote.w*.35,.05,0), new THREE.Vector3(lote.w*.35,.05,0)]);
        const eixoZ = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,.05,-lote.d*.35), new THREE.Vector3(0,.05,lote.d*.35)]);
        grupoLote.add(new THREE.Line(eixoX, materiais.linha));
        grupoLote.add(new THREE.Line(eixoZ, materiais.linha));
    }

    function criarMuro(cfg, lote){
        if(cfg.tipoMuro === 'nenhum'){ return; }
        const mat = cfg.tipoMuro === 'vegetacao' ? materiais.sebe : (cfg.tipoMuro === 'vidro' ? materiais.vidro : materiais.betao);
        const h = cfg.tipoMuro === 'vegetacao' ? 1.55 : 1.35;
        const t = cfg.tipoMuro === 'vidro' ? .16 : .34;
        const y = h / 2;
        const pontos = lotePontos(cfg, lote);
        const gate = gateCoord(cfg, lote);
        const gap = 4.8;
        for(let i=0; i<pontos.length; i++){
            const a = pontos[i];
            const b = pontos[(i+1) % pontos.length];
            construirSegmentoMuro(a, b, gate, gap, h, t, y, mat);
        }
    }

    function construirSegmentoMuro(a, b, gate, gap, h, t, y, mat){
        const dx = b.x - a.x;
        const dz = b.z - a.z;
        const len = Math.sqrt(dx*dx + dz*dz);
        if(len < .4){ return; }
        const ang = Math.atan2(dz, dx);
        const ux = dx / len;
        const uz = dz / len;
        let cortes = [[0, len]];
        if(gate){
            const distGate = distanciaPontoSegmento(gate.x, gate.z, a.x, a.z, b.x, b.z);
            if(distGate < 1.1){
                const proj = clamp(((gate.x - a.x) * dx + (gate.z - a.z) * dz) / (len * len), 0, 1) * len;
                const ini = clamp(proj - gap/2, 0, len);
                const fim = clamp(proj + gap/2, 0, len);
                cortes = [];
                if(ini > .7){ cortes.push([0, ini]); }
                if(fim < len - .7){ cortes.push([fim, len]); }
            }
        }
        cortes.forEach(function(c){
            const l = c[1] - c[0];
            if(l <= .45){ return; }
            const mx = a.x + ux * (c[0] + l/2);
            const mz = a.z + uz * (c[0] + l/2);
            const wall = addBox(grupoLote, l, h, t, mx, y, mz, mat, 'muro');
            wall.rotation.y = -ang;
        });
    }

    function distanciaPontoSegmento(px,pz, ax,az, bx,bz){
        const dx = bx-ax, dz = bz-az;
        const l2 = dx*dx + dz*dz;
        if(l2 === 0){ return Math.sqrt((px-ax)*(px-ax)+(pz-az)*(pz-az)); }
        const t = clamp(((px-ax)*dx + (pz-az)*dz) / l2, 0, 1);
        const x = ax + t*dx, z = az + t*dz;
        return Math.sqrt((px-x)*(px-x)+(pz-z)*(pz-z));
    }

    function addBox(group, w,h,d, x,y,z, mat, name){
        const m = new THREE.Mesh(new THREE.BoxGeometry(w,h,d), mat);
        m.position.set(x,y,z);
        m.castShadow = QUALITY !== 'mobile';
        m.receiveShadow = true;
        if(name){ m.name = name; }
        group.add(m);
        return m;
    }

    function addPlane(group, w,h, x,y,z, rotY, mat, name){
        const m = new THREE.Mesh(new THREE.PlaneGeometry(w,h), mat);
        m.position.set(x,y,z);
        m.rotation.y = rotY || 0;
        m.castShadow = QUALITY !== 'mobile';
        if(name){ m.name = name; }
        group.add(m);
        return m;
    }

    function criarRoadPlane(group, w, d, cx, cz, rotY, cfg){
        const segAlong = QUALITY === 'mobile' ? 8 : 18;
        const segWide = 2;
        const geo = new THREE.PlaneGeometry(w, d, segAlong, segWide);
        geo.rotateX(-Math.PI/2);
        if(rotY){ geo.rotateY(rotY); }
        geo.translate(cx, 0, cz);
        const pos = geo.attributes.position;
        for(let i=0;i<pos.count;i++){
            const x = pos.getX(i); const z = pos.getZ(i);
            pos.setY(i, alturaTerreno(x,z,cfg) + .055);
        }
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, materiais.asfalto);
        mesh.receiveShadow = true;
        group.add(mesh);
        return mesh;
    }

    function criarEstrada(cfg, lote, worldW, worldD){
        if(cfg.estrada === 'nenhuma'){ return; }
        const roadW = 4.8;
        const comp = cfg.estrada === 'frente' || cfg.estrada === 'tras' ? worldW * .9 : worldD * .9;
        const offset = 6.5;
        let cx = 0, cz = 0, rot = 0;
        if(cfg.estrada === 'frente'){ cz = lote.d/2 + offset; rot = 0; }
        if(cfg.estrada === 'tras'){ cz = -lote.d/2 - offset; rot = 0; }
        if(cfg.estrada === 'esquerda'){ cx = -lote.w/2 - offset; rot = Math.PI/2; }
        if(cfg.estrada === 'direita'){ cx = lote.w/2 + offset; rot = Math.PI/2; }
        criarRoadPlane(grupoMundo, comp, roadW, cx, cz, rot, cfg);
        criarMarcasEstrada(cfg, lote, comp, cx, cz, rot);
        criarEntradaLote(cfg, lote);
    }

    function criarMarcasEstrada(cfg, lote, comp, cx, cz, rot){
        const count = Math.floor(comp / 7);
        for(let i=0;i<count;i++){
            const t = -comp/2 + 3 + i*7;
            const isHorizontal = rot === 0;
            const x = isHorizontal ? cx + t : cx;
            const z = isHorizontal ? cz : cz + t;
            const y = alturaTerreno(x,z,cfg) + .08;
            const stripe = new THREE.Mesh(new THREE.BoxGeometry(isHorizontal ? 3.2 : .08, .035, isHorizontal ? .08 : 3.2), materiais.pedra);
            stripe.position.set(x,y,z);
            grupoMundo.add(stripe);
        }
    }

    function gateCoord(cfg, lote){
        let shift = 0;
        const limiteX = lote.w * .22;
        const limiteZ = lote.d * .22;
        if(cfg.entradaLote === 'esquerda'){ shift = -1; }
        if(cfg.entradaLote === 'direita'){ shift = 1; }
        if(cfg.estrada === 'frente'){ return {x:shift*limiteX, z:lote.d/2, dir:'z', sign:1}; }
        if(cfg.estrada === 'tras'){ return {x:shift*limiteX, z:-lote.d/2, dir:'z', sign:-1}; }
        if(cfg.estrada === 'esquerda'){ return {x:-lote.w/2, z:shift*limiteZ, dir:'x', sign:-1}; }
        if(cfg.estrada === 'direita'){ return {x:lote.w/2, z:shift*limiteZ, dir:'x', sign:1}; }
        return null;
    }

    function criarEntradaLote(cfg, lote){
        const g = gateCoord(cfg, lote);
        if(!g){ return; }
        const fp = footprintPrincipal(cfg);
        const c = posicaoCasaNoLote(cfg, lote, fp);
        const width = 3.6;
        let targetX = c.x;
        let targetZ = c.z;
        if(g.dir === 'z'){
            targetZ = c.z + (g.sign > 0 ? fp.d/2 + 1.6 : -fp.d/2 - 1.6);
            const len = Math.max(2.5, Math.abs(g.z - targetZ));
            const zMid = (g.z + targetZ) / 2;
            const xMid = clamp(g.x, -lote.w/2 + 4, lote.w/2 - 4);
            const driveway = addBox(grupoLote, width, .06, len, xMid, .09, zMid, materiais.asfalto, 'entrada-lote');
            driveway.receiveShadow = true;
        }else{
            targetX = c.x + (g.sign > 0 ? fp.w/2 + 1.6 : -fp.w/2 - 1.6);
            const len = Math.max(2.5, Math.abs(g.x - targetX));
            const xMid = (g.x + targetX) / 2;
            const zMid = clamp(g.z, -lote.d/2 + 4, lote.d/2 - 4);
            const driveway = addBox(grupoLote, len, .06, width, xMid, .09, zMid, materiais.asfalto, 'entrada-lote');
            driveway.receiveShadow = true;
        }
    }

    function criarVegetacaoAutomatica(cfg, lote, worldW, worldD){
        if(cfg.tipoPlanta === 'nenhuma'){ return; }
        const max = cfg.densidadeArvores === 'media' ? (QUALITY === 'mobile' ? 12 : 24) : (QUALITY === 'mobile' ? 7 : 14);
        const rng = seededRandom(42 + Math.round(cfg.areaTerreno));
        let count = 0, attempts = 0;
        while(count < max && attempts < max * 25){
            attempts++;
            const x = (rng() - .5) * worldW * .86;
            const z = (rng() - .5) * worldD * .86;
            const distFromLotX = Math.abs(x) - lote.w/2;
            const distFromLotZ = Math.abs(z) - lote.d/2;
            if(distFromLotX < 3 && distFromLotZ < 3){ continue; }
            if(Math.abs(x) > worldW/2 - 4 || Math.abs(z) > worldD/2 - 4){ continue; }
            const tipo = cfg.tipoPlanta === 'misto' ? (rng() > .65 ? 'palmeira' : 'arvore') : (cfg.tipoPlanta === 'palmeiras' ? 'palmeira' : 'arvore');
            criarArvore(grupoMundo, x, alturaTerreno(x,z,cfg), z, tipo, .8 + rng()*.7);
            count++;
        }
    }

    function seededRandom(seed){
        let s = seed % 2147483647;
        return function(){ s = s * 16807 % 2147483647; return (s - 1) / 2147483646; };
    }

    function criarConstrucao(cfg, lote){
        disposeGroup(grupoConstrucao);
        objetosOcupados = [];
        const fp = footprintPrincipal(cfg);
        const pos = posicaoCasaNoLote(cfg, lote, fp);
        const needGrow = validarEspacoBasico(cfg, lote, fp);
        if(needGrow && bootConcluido){ pedirAumentoTerreno(cfg, needGrow); }
        if(cfg.tipo === 'vivenda'){
            construirVivendas(cfg, lote, fp, pos.x, pos.z);
        }else{
            construirEdificio(cfg, fp.unitW, fp.unitD, pos.x, pos.z, 0, cfg.andares, cfg.tipo);
            objetosOcupados.push(rect('Casa principal', pos.x, pos.z, fp.unitW + 2, fp.unitD + 2));
        }
        criarGaragem(cfg, lote, fp, pos);
        criarAnexo(cfg, lote, fp, pos);
        criarPiscina(cfg, lote, fp, pos);
        criarClimatizacao(cfg, lote, fp, pos);
        recriarManuais(cfg, lote);
        atualizarResumo(cfg);
        atualizarHUD(cfg);
    }

    function validarEspacoBasico(cfg, lote, fp){
        const reqW = fp.w + 11;
        const reqD = fp.d + 11;
        let extraW = 0, extraD = 0;
        if(cfg.garagem === 'colada_esq' || cfg.garagem === 'colada_dir'){ extraW += Math.max(6.8, cfg.garagemPortoes*3.4 + 1.4); }
        if(cfg.garagem === 'colada_frente' || cfg.garagem === 'colada_tras'){ extraD += 7.6; }
        if(cfg.anexos !== 'nenhum'){
            const a = dimsAnexo(cfg);
            if(cfg.posicaoAnexo === 'esquerda' || cfg.posicaoAnexo === 'direita'){ extraW += a.w + 4; }
            else{ extraD += a.d + 4; }
        }
        if(cfg.piscina){
            if(cfg.posicaoPiscina === 'esquerda' || cfg.posicaoPiscina === 'direita'){ extraW += cfg.piscinaComprimento + 4; }
            else{ extraD += cfg.piscinaComprimento + 4; }
        }
        const wNeed = reqW + extraW;
        const dNeed = reqD + extraD;
        const areaNeed = Math.ceil(wNeed * dNeed * 1.18 / 10) * 10;
        if((lote.w < wNeed || lote.d < dNeed) && areaNeed > cfg.areaTerreno){ return areaNeed; }
        return 0;
    }

    function pedirAumentoTerreno(cfg, areaNeed){
        const assinatura = cfg.tipo + '|' + cfg.area + '|' + cfg.andares + '|' + cfg.areaTerreno + '|' + cfg.garagem + '|' + cfg.anexos + '|' + cfg.piscina + '|' + areaNeed;
        if(avisoEspacoAssinatura === assinatura){ return; }
        avisoEspacoAssinatura = assinatura;
        mostrarModal('Terreno apertado',
            'A combinação atual pode ficar demasiado apertada no lote.\n\nÁrea atual: ' + Math.round(cfg.areaTerreno) + ' m²\nÁrea aconselhada: ' + Math.round(areaNeed) + ' m²\n\nQuer aumentar automaticamente a área do terreno?',
            [
                {texto:'Manter assim'},
                {texto:'Aumentar terreno', tipo:'primary', acao:function(){ const el = $('area-terreno'); if(el){ el.value = areaNeed; atualizarGeometria(); } }}
            ]
        );
    }

    function construirVivendas(cfg, lote, fp, baseX, baseZ){
        const gap = fp.gap || 0;
        const start = baseX - fp.w/2 + fp.unitW/2;
        for(let i=0; i<fp.unidades; i++){
            const x = start + i * (fp.unitW + gap);
            const z = baseZ;
            construirEdificio(cfg, fp.unitW, fp.unitD, x, z, i, cfg.andares, 'vivenda');
            objetosOcupados.push(rect('Vivenda ' + (i+1), x, z, fp.unitW + 1.2, fp.unitD + 1.6));
            if((cfg.vivendasDisposicao === 'geminadas' || cfg.vivendasDisposicao === 'banda') && i > 0){
                addBox(grupoConstrucao, .18, 3.1 * cfg.andares, fp.unitD, x - fp.unitW/2 - gap/2, (3.1 * cfg.andares)/2, z, materiais.betao, 'parede-divisoria');
            }
        }
    }

    function materialParede(cfg){
        if(cfg.estiloCasa === 'tradicional'){ return materiais.paredeTradicional || materiais.parede; }
        if(cfg.estiloCasa === 'rustico'){ return materiais.paredeRustica || materiais.parede; }
        return materiais.paredeModerna || materiais.parede;
    }


    function escalaPiso(cfg, piso){
        if(!cfg.personalizarPisos){ return {w:1,d:1}; }
        if(piso === 0){ return {w:cfg.piso1Largura/100, d:cfg.piso1Profundidade/100}; }
        if(piso === 1){ return {w:cfg.piso2Largura/100, d:cfg.piso2Profundidade/100}; }
        return {w:cfg.piso3Largura/100, d:cfg.piso3Profundidade/100};
    }

    function ajustarFormatoCasa(cfg, w, d){
        if(cfg.formatoCasa === 'compacta'){ return {w:w*.88,d:d*.88}; }
        if(cfg.formatoCasa === 'l'){ return {w:w*1.08,d:d*.92}; }
        if(cfg.formatoCasa === 'u'){ return {w:w*1.12,d:d*.98}; }
        return {w:w,d:d};
    }

    function materialFachada(valor, cfg){
        if(valor === 'pedra'){ return materiais.fachadaPedra || materiais.pedra; }
        if(valor === 'madeira'){ return materiais.fachadaMadeira || materiais.madeira; }
        if(valor === 'vidro'){ return materiais.fachadaVidro || materiais.vidro; }
        if(valor === 'reboco'){ return materiais.fachadaReboco || materiais.parede; }
        return materialParede(cfg);
    }

    function criarFachadasPersonalizadas(cfg, w, d, x, z, yBase, pe){
        if(!cfg.personalizarPisos){ return; }
        const cy = yBase + pe/2 + .01;
        addPlane(grupoConstrucao, w+.025, pe-.12, x, cy, z+d/2+.051, 0, materialFachada(cfg.paredeFrente, cfg), 'fachada-frente');
        addPlane(grupoConstrucao, w+.025, pe-.12, x, cy, z-d/2-.051, Math.PI, materialFachada(cfg.paredeTras, cfg), 'fachada-tras');
        addPlane(grupoConstrucao, d+.025, pe-.12, x-w/2-.051, cy, z, -Math.PI/2, materialFachada(cfg.paredeEsq, cfg), 'fachada-esq');
        addPlane(grupoConstrucao, d+.025, pe-.12, x+w/2+.051, cy, z, Math.PI/2, materialFachada(cfg.paredeDir, cfg), 'fachada-dir');
    }

    function construirEdificio(cfg, w, d, x, z, idx, pisos, tipo){
        const pe = tipo === 'predio' ? 3.05 : 3.0;
        const pisosCount = pisos || 1;
        let roofW = w;
        let roofD = d;
        let roofX = x;
        let roofZ = z;
        for(let p=0; p<pisosCount; p++){
            let shape = ajustarFormatoCasa(cfg, w, d);
            let wp = shape.w;
            let dp = shape.d;
            let xp = x;
            let zp = z;
            const esc = escalaPiso(cfg, p);
            wp *= esc.w;
            dp *= esc.d;
            if(cfg.assimetria && p > 0){ wp *= .88; dp *= .88; xp += w*.04; zp -= d*.04; }
            const corpo = addBox(grupoConstrucao, wp, pe, dp, xp, pe/2 + p*pe, zp, materialParede(cfg), 'corpo');
            corpo.userData = {tipoObjeto:'fachada'};
            criarFachadasPersonalizadas(cfg, wp, dp, xp, zp, p*pe, pe);
            addFrisos(wp, dp, xp, p*pe + .04, zp);
            criarAberturas(cfg, wp, dp, xp, zp, p, pe, tipo);
            roofW = wp; roofD = dp; roofX = xp; roofZ = zp;
            if(cfg.formatoCasa === 'l' && p === 0){
                const aw = Math.max(3.4, w*(cfg.formatoLarguraL/100)), ad = Math.max(3.2, d*(cfg.formatoProfundidadeL/100));
                const ax = x + wp/2 - aw/2;
                const az = z - dp/2 - ad/2 + .2;
                addBox(grupoConstrucao, aw, pe, ad, ax, pe/2, az, materialParede(cfg), 'volume-l');
                addPlane(grupoConstrucao, .9, 1.0, ax, 1.7, az-ad/2-.04, Math.PI, materiais.janela, 'janela-volume-l');
                if(pisosCount === 1){ criarTelhado(cfg, aw, ad, ax, az, pe, 'volume-l'); }
            }
            if(cfg.formatoCasa === 'u' && p === 0){
                const aw = Math.max(3.2, w*(cfg.formatoLarguraU/100)), ad = Math.max(3.0, d*(cfg.formatoProfundidadeU/100));
                const abertura = clamp(cfg.formatoAberturaU/100, .18, .70);
                const margemU = Math.max(.3, (wp - (aw*2) - (wp*abertura)) / 2);
                const ux1 = x-wp/2+aw/2+margemU*.25;
                const ux2 = x+wp/2-aw/2-margemU*.25;
                const uz = z-dp/2-ad/2+.3;
                addBox(grupoConstrucao, aw, pe, ad, ux1, pe/2, uz, materialParede(cfg), 'volume-u-esq');
                addBox(grupoConstrucao, aw, pe, ad, ux2, pe/2, uz, materialParede(cfg), 'volume-u-dir');
                if(pisosCount === 1){
                    criarTelhado(cfg, aw, ad, ux1, uz, pe, 'volume-u-esq');
                    criarTelhado(cfg, aw, ad, ux2, uz, pe, 'volume-u-dir');
                }
            }
        }
        const topY = pe * pisosCount;
        criarTelhado(cfg, roofW, roofD, roofX, roofZ, topY, tipo);
        if(cfg.garagem === 'integrada' && idx === 0){ criarPortoesNaFachada(cfg, x, z + d/2 + .035, topY, w, 'frente'); }
    }


    function addFrisos(w,d,x,y,z){
        addBox(grupoConstrucao, w+.45, .12, .25, x, y, z+d/2+.08, materiais.madeira, 'rodape-frontal');
        addBox(grupoConstrucao, w+.45, .12, .25, x, y, z-d/2-.08, materiais.madeira, 'rodape-traseiro');
        addBox(grupoConstrucao, .25, .12, d+.45, x+w/2+.08, y, z, materiais.madeira, 'rodape-lat');
        addBox(grupoConstrucao, .25, .12, d+.45, x-w/2-.08, y, z, materiais.madeira, 'rodape-lat');
    }

    function criarAberturas(cfg, w, d, x, z, piso, pe, tipo){
        const yBase = piso * pe;
        const frontZ = z + d/2 + .035;
        const backZ = z - d/2 - .035;
        const leftX = x - w/2 - .035;
        const rightX = x + w/2 + .035;
        const garagemIntegradaPiso = cfg.garagem === 'integrada' && piso === 0;
        if(piso === 0){
            const portaX = garagemIntegradaPiso ? x - w*.38 : x - w*.18;
            addPlane(grupoConstrucao, .95, 2.1, portaX, yBase + 1.08, frontZ, 0, materiais.porta, 'porta');
        }
        const n = w > 14 ? 3 : 2;
        for(let i=0;i<n;i++){
            const px = x - w*.32 + i * (w*.64 / Math.max(1,n-1));
            if(piso === 0 && Math.abs(px - (garagemIntegradaPiso ? x - w*.38 : x - w*.18)) < 1.6){ continue; }
            if(!garagemIntegradaPiso){
                addPlane(grupoConstrucao, 1.05, 1.05, px, yBase + 1.8, frontZ, 0, materiais.janela, 'janela');
            }
            addPlane(grupoConstrucao, 1.05, 1.05, px, yBase + 1.8, backZ, Math.PI, materiais.janela, 'janela');
        }
        addPlane(grupoConstrucao, 1.0, 1.0, leftX, yBase + 1.7, z, -Math.PI/2, materiais.janela, 'janela');
        addPlane(grupoConstrucao, 1.0, 1.0, rightX, yBase + 1.7, z, Math.PI/2, materiais.janela, 'janela');
    }

    function criarPortoesNaFachada(cfg, x, z, topY, w, face){
        const portas = clamp(cfg.garagemPortoes || 1, 1, 4);
        const larguraPortao = Math.min(2.55, Math.max(1.65, (w * .42) / portas - .22));
        const total = portas * larguraPortao + (portas - 1) * .38;
        const centroGaragem = x + w*.22;
        const start = centroGaragem - total/2 + larguraPortao/2;
        for(let i=0;i<portas;i++){
            addPlane(grupoConstrucao, larguraPortao, 2.15, start + i*(larguraPortao+.38), 1.12, z, 0, materiais.portao, 'portao-garagem');
        }
        if(cfg.garagemPortaLateral){ addPlane(grupoConstrucao, .88, 2.0, x - w*.38, 1.05, z, 0, materiais.porta, 'porta-lateral-garagem'); }
    }

    function inclinacaoValor(cfg){
        if(cfg.inclinacaoTelhado === 'baixa'){ return 1.6; }
        if(cfg.inclinacaoTelhado === 'alta'){ return 3.2; }
        return 2.35;
    }

    function criarTelhado(cfg, w, d, x, z, topY, tipo){
        const t = cfg.telhado;
        const over = t === 'beiral' ? .9 : .46;
        const mat = t === 'sandwich' || t === 'plano' ? materiais.telheadoEscuro : materiais.telheado;
        const baseY = topY + .03;
        const rise = inclinacaoValor(cfg);
        if(t === 'plano'){
            addBox(grupoConstrucao, w + .55, .34, d + .55, x, topY + .17, z, mat, 'telhado-plano');
            addBox(grupoConstrucao, w + .85, .20, .24, x, topY + .44, z + d/2 + .35, materiais.madeira, 'beiral-frente');
            addBox(grupoConstrucao, w + .85, .20, .24, x, topY + .44, z - d/2 - .35, materiais.madeira, 'beiral-traseiro');
            criarElementosNoTelhado(cfg, w, d, x, z, topY + .38, 'plano', cfg.orientacaoTelhado, 0);
            return;
        }
        if(t === 'uma_agua' || t === 'sandwich'){
            criarParedesTelhadoUmaAgua(w, d, x, z, topY, rise, cfg.orientacaoTelhado, cfg);
            criarRoofUmaAgua(w + over*2, d + over*2, x, z, baseY, rise, cfg.orientacaoTelhado, mat);
            criarElementosNoTelhado(cfg, w + over*2, d + over*2, x, z, baseY, 'uma_agua', cfg.orientacaoTelhado, rise);
            return;
        }
        if(t === 'duas_aguas' || t === 'beiral'){
            criarRoofDuasAguas(w + over*2, d + over*2, x, z, baseY, rise, cfg.orientacaoTelhado, mat);
            criarElementosNoTelhado(cfg, w + over*2, d + over*2, x, z, baseY, 'duas_aguas', cfg.orientacaoTelhado, rise);
            return;
        }
        if(t === 'quatro_aguas'){
            criarRoofQuatroAguas(w + over*2, d + over*2, x, z, baseY, rise, mat);
            criarElementosNoTelhado(cfg, w + over*2, d + over*2, x, z, baseY, 'quatro_aguas', cfg.orientacaoTelhado, rise);
        }
    }

    function addRoofMesh(vertices, indices, mat, x, z, name){
        const geo = new THREE.BufferGeometry();
        geo.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
        geo.setIndex(indices);
        geo.computeVertexNormals();
        const mesh = new THREE.Mesh(geo, mat);
        mesh.position.set(x, 0, z);
        mesh.castShadow = QUALITY !== 'mobile';
        mesh.receiveShadow = true;
        if(name){ mesh.name = name; }
        grupoConstrucao.add(mesh);
        return mesh;
    }

    function criarParedesTelhadoUmaAgua(w, d, x, z, topY, rise, orientation, cfg){
        const mat = materialParede(cfg);
        const hw = w / 2;
        const hd = d / 2;
        const eps = 0.025;

        function addWallMesh(verts, faces, nome){
            const geo = new THREE.BufferGeometry();
            geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
            geo.setIndex(faces);
            geo.computeVertexNormals();
            const mesh = new THREE.Mesh(geo, mat);
            mesh.position.set(x, 0, z);
            mesh.castShadow = QUALITY !== 'mobile';
            mesh.receiveShadow = true;
            mesh.name = nome;
            grupoConstrucao.add(mesh);
            return mesh;
        }

        if(orientation === 'frente_tras'){
            // parede alta traseira entre a laje e a parte alta do telhado
            addBox(grupoConstrucao, w + .04, rise, .10, x, topY + rise/2, z + hd + eps, mat, 'parede-alta-telhado-uma-agua');
            // paredes laterais trapezoidais que fecham o triângulo da cobertura de uma água
            addWallMesh([
                -hw - eps, topY, -hd,  -hw - eps, topY, hd,  -hw - eps, topY + rise, hd,
                -hw - eps, topY, -hd,  -hw - eps, topY + rise, hd, -hw - eps, topY + .03, -hd,
                 hw + eps, topY, -hd,   hw + eps, topY + rise, hd,  hw + eps, topY, hd,
                 hw + eps, topY, -hd,   hw + eps, topY + .03, -hd, hw + eps, topY + rise, hd
            ], [0,1,2,3,4,5,6,7,8,9,10,11], 'empenas-laterais-uma-agua');
        }else{
            // parede alta lateral entre a laje e a parte alta do telhado
            addBox(grupoConstrucao, .10, rise, d + .04, x - hw - eps, topY + rise/2, z, mat, 'parede-alta-telhado-uma-agua');
            // paredes frontal/traseira trapezoidais que fecham o triângulo da cobertura de uma água
            addWallMesh([
                -hw, topY + rise, -hd - eps,  hw, topY, -hd - eps,  -hw, topY, -hd - eps,
                -hw, topY + rise, -hd - eps,  -hw, topY, -hd - eps, -hw, topY + rise, -hd - eps,
                -hw, topY + rise,  hd + eps,  -hw, topY,  hd + eps,  hw, topY,  hd + eps,
                -hw, topY + rise,  hd + eps,  -hw, topY + rise,  hd + eps, hw, topY, hd + eps
            ], [0,1,2,3,4,5,6,7,8,9,10,11], 'empenas-frente-tras-uma-agua');
        }
    }

    function criarRoofDuasAguas(w,d,x,z,y,rise,orientation,mat){
        const hw = w/2, hd = d/2;
        if(orientation === 'frente_tras'){
            const verts = [
                -hw,y,-hd,   hw,y,-hd,   -hw,y,hd,   hw,y,hd,
                  0,y+rise,-hd, 0,y+rise,hd
            ];
            const faces = [
                0,4,5, 0,5,2,
                1,3,5, 1,5,4,
                0,1,4,
                2,5,3,
                0,2,3, 0,3,1
            ];
            addRoofMesh(verts, faces, mat, x, z, 'telhado-duas-aguas');
            addBox(grupoConstrucao, .22, .22, d + .38, x, y + rise + .04, z, materiais.madeira, 'cumeeira');
            addBox(grupoConstrucao, .20, .20, d + .45, x - hw, y + .08, z, materiais.madeira, 'beiral-esq');
            addBox(grupoConstrucao, .20, .20, d + .45, x + hw, y + .08, z, materiais.madeira, 'beiral-dir');
            addBox(grupoConstrucao, w + .28, .16, .18, x, y + .08, z + hd, materiais.madeira, 'beiral-frente');
            addBox(grupoConstrucao, w + .28, .16, .18, x, y + .08, z - hd, materiais.madeira, 'beiral-tras');
        }else{
            const verts = [
                -hw,y,-hd,   hw,y,-hd,   -hw,y,hd,   hw,y,hd,
                -hw,y+rise,0, hw,y+rise,0
            ];
            const faces = [
                0,1,5, 0,5,4,
                2,4,5, 2,5,3,
                0,4,2,
                1,3,5,
                0,2,3, 0,3,1
            ];
            addRoofMesh(verts, faces, mat, x, z, 'telhado-duas-aguas');
            addBox(grupoConstrucao, w + .38, .22, .22, x, y + rise + .04, z, materiais.madeira, 'cumeeira');
            addBox(grupoConstrucao, w + .45, .20, .20, x, y + .08, z - hd, materiais.madeira, 'beiral-tras');
            addBox(grupoConstrucao, w + .45, .20, .20, x, y + .08, z + hd, materiais.madeira, 'beiral-frente');
            addBox(grupoConstrucao, .18, .16, d + .28, x - hw, y + .08, z, materiais.madeira, 'beiral-esq');
            addBox(grupoConstrucao, .18, .16, d + .28, x + hw, y + .08, z, materiais.madeira, 'beiral-dir');
        }
    }

    function criarRoofUmaAgua(w,d,x,z,y,rise,orientation,mat){
        const hw = w/2, hd = d/2;
        if(orientation === 'frente_tras'){
            const verts = [
                -hw,y,-hd, hw,y,-hd, -hw,y+rise,hd, hw,y+rise,hd,
                -hw,y-.08,-hd, hw,y-.08,-hd, -hw,y+rise-.08,hd, hw,y+rise-.08,hd
            ];
            const faces = [0,1,3, 0,3,2, 4,6,7, 4,7,5, 0,4,5, 0,5,1, 2,3,7, 2,7,6, 0,2,6, 0,6,4, 1,5,7, 1,7,3];
            addRoofMesh(verts, faces, mat, x, z, 'telhado-uma-agua');
            addBox(grupoConstrucao, w+.25, .18, .20, x, y + rise + .02, z + hd, materiais.madeira, 'remate-alto');
            addBox(grupoConstrucao, w+.25, .18, .20, x, y + .04, z - hd, materiais.madeira, 'beiral-baixo');
        }else{
            const verts = [
                -hw,y+rise,-hd, -hw,y+rise,hd, hw,y,-hd, hw,y,hd,
                -hw,y+rise-.08,-hd, -hw,y+rise-.08,hd, hw,y-.08,-hd, hw,y-.08,hd
            ];
            const faces = [0,2,3, 0,3,1, 4,5,7, 4,7,6, 0,4,6, 0,6,2, 1,3,7, 1,7,5, 0,1,5, 0,5,4, 2,6,7, 2,7,3];
            addRoofMesh(verts, faces, mat, x, z, 'telhado-uma-agua');
            addBox(grupoConstrucao, .20, .18, d+.25, x - hw, y + rise + .02, z, materiais.madeira, 'remate-alto');
            addBox(grupoConstrucao, .20, .18, d+.25, x + hw, y + .04, z, materiais.madeira, 'beiral-baixo');
        }
    }

    function criarRoofQuatroAguas(w,d,x,z,y,rise,mat){
        const hw=w/2, hd=d/2;
        const verts = [-hw,y,-hd, hw,y,-hd, hw,y,hd, -hw,y,hd, 0,y+rise,0, 0,y-.08,0];
        const faces = [0,1,4, 1,2,4, 2,3,4, 3,0,4, 0,3,5, 0,5,1, 1,5,2, 2,5,3];
        addRoofMesh(verts, faces, mat, x, z, 'telhado-quatro-aguas');
        addBox(grupoConstrucao, w+.3, .16, .16, x, y+.05, z-d/2, materiais.madeira, 'beiral');
        addBox(grupoConstrucao, w+.3, .16, .16, x, y+.05, z+d/2, materiais.madeira, 'beiral');
        addBox(grupoConstrucao, .16, .16, d+.3, x-w/2, y+.05, z, materiais.madeira, 'beiral');
        addBox(grupoConstrucao, .16, .16, d+.3, x+w/2, y+.05, z, materiais.madeira, 'beiral');
    }

    function alturaNoTelhado(tipo, orientation, relX, relZ, w, d, baseY, rise){
        if(tipo === 'plano'){ return baseY; }
        if(tipo === 'uma_agua'){
            if(orientation === 'frente_tras'){ return baseY + rise * ((relZ + d/2) / d); }
            return baseY + rise * (1 - ((relX + w/2) / w));
        }
        if(tipo === 'quatro_aguas'){
            const nx = Math.abs(relX) / Math.max(.001, w/2);
            const nz = Math.abs(relZ) / Math.max(.001, d/2);
            return baseY + rise * (1 - Math.max(nx, nz));
        }
        // duas águas
        if(orientation === 'frente_tras'){ return baseY + rise * (1 - Math.abs(relX) / Math.max(.001, w/2)); }
        return baseY + rise * (1 - Math.abs(relZ) / Math.max(.001, d/2));
    }

    function addRoofAccessory(w,d,x,y,z,mat,name,rotX,rotZ){
        const mesh = addBox(grupoConstrucao, w, .10, d, x, y, z, mat, name);
        mesh.rotation.x = rotX || 0;
        mesh.rotation.z = rotZ || 0;
        mesh.castShadow = false;
        mesh.receiveShadow = true;
        return mesh;
    }

    function criarElementosNoTelhado(cfg, w, d, x, z, baseY, tipo, orientation, rise){
        const angleX = Math.atan2(rise || 0, d || 1);
        const angleZ = Math.atan2(rise || 0, w || 1);
        const roofOffset = tipo === 'plano' ? .24 : .18;

        if(cfg.paineis){
            const count = w > 12 ? 4 : 2;
            const step = 1.65;
            for(let i=0;i<count;i++){
                let relX = (i - (count-1)/2) * step;
                let relZ = -d * .18;
                let rotX = 0, rotZ = 0;
                if(tipo === 'uma_agua'){
                    if(orientation === 'frente_tras'){ relZ = -d*.05; rotX = -angleX; }
                    else{ relX = w*.12; relZ = (i - (count-1)/2) * step; rotZ = -angleZ; }
                }else if(tipo === 'duas_aguas'){
                    if(orientation === 'frente_tras'){ relX = w*.20; rotZ = -Math.atan2(rise, w/2); relZ = (i - (count-1)/2) * step; }
                    else{ relZ = -d*.20; rotX = Math.atan2(rise, d/2); relX = (i - (count-1)/2) * step; }
                }else if(tipo === 'quatro_aguas'){
                    relZ = -d*.16; rotX = Math.atan2(rise, d/2);
                }
                const y = alturaNoTelhado(tipo, orientation, relX, relZ, w, d, baseY, rise || 0) + roofOffset;
                addRoofAccessory(1.35, 2.15, x + relX, y, z + relZ, materiais.solar, 'painel-solar', rotX, rotZ);
            }
        }
        if(cfg.claraboias > 0){
            for(let c=0;c<cfg.claraboias;c++){
                let relX = (c - (cfg.claraboias-1)/2) * 1.55;
                let relZ = d*.16;
                let rotX = 0, rotZ = 0;
                if(tipo === 'uma_agua'){
                    if(orientation === 'frente_tras'){ relZ = d*.08; rotX = -angleX; }
                    else{ relX = -w*.12; relZ = (c - (cfg.claraboias-1)/2) * 1.55; rotZ = -angleZ; }
                }else if(tipo === 'duas_aguas'){
                    if(orientation === 'frente_tras'){ relX = -w*.20; relZ = (c - (cfg.claraboias-1)/2) * 1.55; rotZ = Math.atan2(rise, w/2); }
                    else{ relZ = d*.20; relX = (c - (cfg.claraboias-1)/2) * 1.55; rotX = -Math.atan2(rise, d/2); }
                }else if(tipo === 'quatro_aguas'){
                    relZ = d*.12; rotX = -Math.atan2(rise, d/2);
                }
                const y = alturaNoTelhado(tipo, orientation, relX, relZ, w, d, baseY, rise || 0) + roofOffset + .04;
                addRoofAccessory(1.08, 1.08, x + relX, y, z + relZ, materiais.claraboia || materiais.vidro, 'claraboia', rotX, rotZ);
                addRoofAccessory(1.22, .08, x + relX, y - .025, z + relZ, materiais.preto, 'aro-claraboia', rotX, rotZ);
            }
        }
    }

    function criarGaragem(cfg, lote, fp, posCasa){
        if(cfg.garagem === 'nenhuma' || cfg.garagem === 'integrada' || cfg.garagem === 'subterranea'){ return; }
        const w = Math.max(6.2, cfg.garagemPortoes * 3.25 + 1.2);
        const d = 6.5;
        const h = 2.8;
        let x = posCasa.x;
        let z = posCasa.z;
        let face = 'frente';
        if(cfg.garagem === 'colada_esq'){ x = posCasa.x - fp.w/2 - w/2 - .08; z = posCasa.z; face = 'frente'; }
        else if(cfg.garagem === 'colada_dir'){ x = posCasa.x + fp.w/2 + w/2 + .08; z = posCasa.z; face = 'frente'; }
        else if(cfg.garagem === 'colada_frente'){ x = posCasa.x; z = posCasa.z + fp.d/2 + d/2 + .08; face = 'frente'; }
        else if(cfg.garagem === 'colada_tras'){ x = posCasa.x; z = posCasa.z - fp.d/2 - d/2 - .08; face = 'tras'; }

        const gRect = rect('Garagem', x, z, w, d);
        if(!insideLotRect(gRect, lote, 1.3)){
            if(bootConcluido){ mostrarModal('Garagem sem espaço', 'Não existe espaço livre dentro do lote para colocar a garagem colada à casa. Aumente o terreno ou escolha outra posição.', [{texto:'OK', tipo:'primary'}]); }
            return;
        }
        for(let i=0; i<objetosOcupados.length; i++){
            const obj = objetosOcupados[i];
            if(obj.name && (obj.name.indexOf('Casa') >= 0 || obj.name.indexOf('Vivenda') >= 0)){ continue; }
            if(intersectRect(gRect, obj, .7)){
                if(bootConcluido){ mostrarModal('Garagem sem espaço', 'A garagem colada iria sobrepor outro elemento. Escolha outra posição.', [{texto:'OK', tipo:'primary'}]); }
                return;
            }
        }
        addBox(grupoConstrucao, w, h, d, x, h/2, z, materialParede(cfg), 'garagem-colada');
        const cfgGaragemTelhado = Object.assign({}, cfg, {telhado: cfg.garagemTelhado || 'uma_agua', orientacaoTelhado:'frente_tras', inclinacaoTelhado:'baixa', paineis:false, claraboias:0});
        criarTelhado(cfgGaragemTelhado, w, d, x, z, h, 'garagem');
        if(face === 'tras'){
            criarPortoesIndependentes(cfg.garagemPortoes, x, z - d/2 - .04, w, Math.PI);
        }else{
            criarPortoesIndependentes(cfg.garagemPortoes, x, z + d/2 + .04, w, 0);
        }
        if(cfg.garagemPortaLateral){
            const sideX = cfg.garagem === 'colada_esq' ? x - w/2 - .04 : x + w/2 + .04;
            addPlane(grupoConstrucao,.88,1.95,sideX,1.0,z, sideX < x ? -Math.PI/2 : Math.PI/2, materiais.porta, 'porta-garagem-lateral');
        }
        objetosOcupados.push(rect('Garagem', x, z, w + .8, d + .8));
    }

    function criarPortoesIndependentes(qtd, x, z, w, rotY){
        const portas = clamp(qtd || 1, 1, 4);
        const larguraPortao = Math.min(2.7, (w - 1.4) / portas - .2);
        const total = portas*larguraPortao + (portas-1)*.35;
        const start = x - total/2 + larguraPortao/2;
        for(let i=0;i<portas;i++){ addPlane(grupoConstrucao, larguraPortao, 2.0, start + i*(larguraPortao+.35), 1.05, z, rotY || 0, materiais.portao, 'portao'); }
    }

    function dimsAnexo(cfg){
        let base;
        if(cfg.anexos === 'lazer'){ base = {w:10, d:5.4, h:2.75}; }
        else if(cfg.anexos === 'oficina'){ base = {w:Math.max(7, cfg.garagemAnexoPortoes*3.3 + 1.2), d:6.2, h:2.9}; }
        else if(cfg.anexos === 'garagem'){ base = {w:Math.max(6.8, cfg.garagemAnexoPortoes*3.3 + 1.2), d:6.2, h:2.85}; }
        else if(cfg.anexos === 'arrumos'){ base = {w:5.4, d:4.2, h:2.6}; }
        else{ base = {w:0,d:0,h:0}; }
        if(cfg && cfg.anexoLargura > 0){ base.w = clamp(cfg.anexoLargura, 2.5, 30); }
        if(cfg && cfg.anexoProfundidade > 0){ base.d = clamp(cfg.anexoProfundidade, 2.5, 25); }
        return base;
    }


    function posElemento(cfg, lote, fp, posCasa, w, d, posicao, offset){
        const margem = 3.2;
        offset = offset || 2.8;
        let x = posCasa.x;
        let z = posCasa.z;
        if(posicao === 'direita'){ x = Math.min(lote.w/2 - margem - w/2, posCasa.x + fp.w/2 + w/2 + offset); z = posCasa.z; }
        if(posicao === 'esquerda'){ x = Math.max(-lote.w/2 + margem + w/2, posCasa.x - fp.w/2 - w/2 - offset); z = posCasa.z; }
        if(posicao === 'frente'){ z = Math.min(lote.d/2 - margem - d/2, posCasa.z + fp.d/2 + d/2 + offset); x = posCasa.x; }
        if(posicao === 'tras'){ z = Math.max(-lote.d/2 + margem + d/2, posCasa.z - fp.d/2 - d/2 - offset); x = posCasa.x; }
        const r = corrigirDentroLote(rect('elemento', x, z, w, d), lote, margem);
        return {x:r.x,z:r.z};
    }

    function corrigirDentroLote(r, lote, margin){
        const x = clamp(r.x, -lote.w/2 + margin + r.w/2, lote.w/2 - margin - r.w/2);
        const z = clamp(r.z, -lote.d/2 + margin + r.d/2, lote.d/2 - margin - r.d/2);
        return rect(r.name, x, z, r.w, r.d);
    }

    function rectLivre(r, lote, margin){
        const rr = corrigirDentroLote(r, lote, margin || 2.2);
        if(!insideLotRect(rr, lote, margin || 2.2)){ return null; }
        for(let i=0; i<objetosOcupados.length; i++){
            if(intersectRect(rr, objetosOcupados[i], 1.25)){ return null; }
        }
        return rr;
    }

    function encontrarPosicaoLivre(rInicial, lote, margin){
        const m = margin || 2.2;
        const tentativa = rectLivre(rInicial, lote, m);
        if(tentativa){ return tentativa; }
        const passos = [3, 5, 7, 9, 12, 15, 18];
        const dirs = [[1,0],[-1,0],[0,1],[0,-1],[1,1],[-1,1],[1,-1],[-1,-1]];
        for(let p=0; p<passos.length; p++){
            for(let d=0; d<dirs.length; d++){
                const cand = rect(rInicial.name, rInicial.x + dirs[d][0]*passos[p], rInicial.z + dirs[d][1]*passos[p], rInicial.w, rInicial.d);
                const livre = rectLivre(cand, lote, m);
                if(livre){ return livre; }
            }
        }
        const gridStep = 3.5;
        for(let x=-lote.w/2 + m + rInicial.w/2; x<=lote.w/2 - m - rInicial.w/2; x+=gridStep){
            for(let z=-lote.d/2 + m + rInicial.d/2; z<=lote.d/2 - m - rInicial.d/2; z+=gridStep){
                const livre = rectLivre(rect(rInicial.name, x, z, rInicial.w, rInicial.d), lote, m);
                if(livre){ return livre; }
            }
        }
        return null;
    }

    function rectLivreComIgnorados(rInicial, lote, margin, ignorarNomes){
        const m = margin || 2.2;
        const rr = corrigirDentroLote(rInicial, lote, m);
        if(!insideLotRect(rr, lote, m)){ return null; }
        const ignorar = ignorarNomes || [];
        for(let i=0; i<objetosOcupados.length; i++){
            const nome = objetosOcupados[i].name || '';
            if(ignorar.indexOf(nome) >= 0){ continue; }
            if(intersectRect(rr, objetosOcupados[i], 1.25)){ return null; }
        }
        return rr;
    }

    function criarAnexo(cfg, lote, fp, posCasa){
        if(cfg.anexos === 'nenhum'){ return; }
        const d = dimsAnexo(cfg);
        let p;
        if(cfg.anexoManual && isFinite(cfg.anexoX) && isFinite(cfg.anexoZ)){
            p = {x: cfg.anexoX, z: cfg.anexoZ};
        }else{
            p = posElemento(cfg, lote, fp, posCasa, d.w, d.d, cfg.posicaoAnexo, 4.2);
        }
        const anexoRect = rect('Anexo', p.x, p.z, d.w, d.d);
        const livre = cfg.anexoManual ? rectLivreComIgnorados(anexoRect, lote, 2.3, []) : encontrarPosicaoLivre(anexoRect, lote, 2.3);
        if(!livre){
            if(bootConcluido){ mostrarModal('Anexo sem espaço', 'Não existe espaço livre dentro do lote para colocar o anexo sem ficar por cima da casa, garagem ou piscina.', [{texto:'OK', tipo:'primary'}]); }
            return;
        }
        const x = livre.x, z = livre.z;
        addBox(grupoConstrucao, d.w, d.h, d.d, x, d.h/2, z, materiais.parede, 'anexo');
        const cfgAnexoTelhado = Object.assign({}, cfg, {
            telhado: cfg.anexoTelhado || 'uma_agua',
            orientacaoTelhado: 'frente_tras',
            inclinacaoTelhado: 'baixa',
            paineis: false,
            claraboias: 0
        });
        criarTelhado(cfgAnexoTelhado, d.w, d.d, x, z, d.h, 'anexo');
        addPlane(grupoConstrucao, .9, 1.95, x - d.w*.18, 1.0, z + d.d/2 + .035, 0, materiais.porta, 'porta-anexo');
        for(let i=0;i<cfg.portasAnexo;i++){
            addPlane(grupoConstrucao, .8, 1.8, x - d.w/2 - .035, 1.0, z - d.d*.25 + i*1.6, -Math.PI/2, materiais.porta, 'porta-lateral-anexo');
        }
        if(cfg.anexos === 'garagem' || cfg.anexos === 'oficina'){
            criarPortoesIndependentes(cfg.garagemAnexoPortoes, x, z + d.d/2 + .04, d.w, 0);
        }else{
            addPlane(grupoConstrucao, 1.0, 1.0, x + d.w*.18, 1.55, z + d.d/2+.035, 0, materiais.janela, 'janela-anexo');
        }
        objetosOcupados.push(rect('Anexo', x, z, d.w + 1, d.d + 1));
    }

    function criarPiscina(cfg, lote, fp, posCasa){
        if(!cfg.piscina){ return; }
        const comp = cfg.piscinaComprimento;
        const larg = cfg.piscinaLargura;
        let base;
        if(cfg.piscinaManual && isFinite(cfg.piscinaX) && isFinite(cfg.piscinaZ)){
            base = {x:cfg.piscinaX, z:cfg.piscinaZ};
        }else{
            base = posElemento(cfg, lote, fp, posCasa, comp + 2, larg + 2, cfg.posicaoPiscina, 3.6);
        }
        const alvo = rect('Piscina', base.x, base.z, comp + 2, larg + 2);
        const livre = cfg.piscinaManual ? rectLivreComIgnorados(alvo, lote, 2.3, []) : encontrarPosicaoLivre(alvo, lote, 2.3);
        if(!livre){
            if(bootConcluido){ mostrarModal('Piscina sem espaço', 'Não existe espaço livre dentro do lote para colocar a piscina sem colidir com casa, garagem, anexo ou outros elementos. Escolha outro ponto ou aumente o terreno.', [{texto:'OK', tipo:'primary'}]); }
            return;
        }
        const deck = addBox(grupoConstrucao, comp+1.7, .1, larg+1.7, livre.x, .06, livre.z, materiais.betao, 'deck-piscina');
        deck.receiveShadow = true;
        const agua = addBox(grupoConstrucao, comp, .12, larg, livre.x, .14, livre.z, materiais.agua, 'agua-piscina');
        agua.receiveShadow = false;
        objetosOcupados.push(rect('Piscina', livre.x, livre.z, comp + 2, larg + 2));
    }

    function criarArvore(group, x, y, z, tipo, scale){
        scale = scale || 1;
        const tronco = new THREE.Mesh(new THREE.CylinderGeometry(.18*scale, .25*scale, 2.1*scale, 8), materiais.tronco);
        tronco.position.set(x, y + 1.05*scale, z);
        tronco.castShadow = QUALITY !== 'mobile';
        group.add(tronco);
        if(tipo === 'palmeira'){
            const copa = new THREE.Mesh(new THREE.ConeGeometry(1.25*scale, 2.6*scale, 7), materiais.folha);
            copa.position.set(x, y + 2.7*scale, z);
            copa.rotation.x = deg(8);
            copa.castShadow = QUALITY !== 'mobile';
            group.add(copa);
        }else{
            const copa1 = new THREE.Mesh(new THREE.SphereGeometry(1.05*scale, QUALITY==='mobile'?10:14, QUALITY==='mobile'?8:12), materiais.folha);
            copa1.position.set(x, y + 2.35*scale, z);
            copa1.castShadow = QUALITY !== 'mobile';
            group.add(copa1);
            if(QUALITY !== 'mobile'){
                const copa2 = new THREE.Mesh(new THREE.SphereGeometry(.82*scale, 12, 10), materiais.folha);
                copa2.position.set(x+.55*scale, y+2.15*scale, z-.25*scale); copa2.castShadow=true; group.add(copa2);
            }
        }
    }

    function criarCandeeiro(group, x, y, z){
        addBox(group, .12, 2.6, .12, x, y+1.3, z, materiais.preto, 'candeeiro');
        const luz = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 8), new THREE.MeshStandardMaterial({color:0xfff7cc, emissive:0xffd56a, emissiveIntensity:.55}));
        luz.position.set(x, y+2.75, z); group.add(luz);
    }

    function criarRocha(group, x, y, z){
        const r = new THREE.Mesh(new THREE.DodecahedronGeometry(.62, 0), materiais.pedra);
        r.position.set(x, y+.32, z); r.rotation.set(Math.random(), Math.random(), Math.random()); r.scale.set(1.2,.65,.9); r.castShadow=QUALITY!=='mobile'; group.add(r);
    }

    function criarPlanta(group, x, y, z, scale){
        scale = scale || 1;
        for(let i=0;i<5;i++){
            const folha = new THREE.Mesh(new THREE.SphereGeometry(.22*scale, 8, 6), materiais.folha);
            const ang = (i/5) * Math.PI * 2;
            folha.position.set(x + Math.cos(ang)*.32*scale, y + .22*scale, z + Math.sin(ang)*.32*scale);
            folha.scale.set(1.2,.7,1.0);
            folha.castShadow = QUALITY !== 'mobile';
            group.add(folha);
        }
    }

    function criarDeckManual(group, x, y, z, scale, item){
        item = item || {};
        const rot = item.rotY || 0;
        const local = new THREE.Group();
        local.position.set(x, y, z);
        local.rotation.y = rot;
        group.add(local);
        const dim = manualDim('deck', item || {});
        const w = dim.w * (scale || 1), d = dim.d * (scale || 1);
        addBox(local, w, .12, d, 0, .08, 0, materiais.madeira, 'deck-manual');
        for(let i=-2;i<=2;i++){
            addBox(local, .045, .04, d+.08, i*w/5, .17, 0, materiais.betao, 'junta-deck');
        }
    }


    function criarPergolaManual(group, x, y, z, scale, item){
        scale = scale || 1;
        item = item || {};
        const rot = item.rotY || 0;
        const local = new THREE.Group();
        local.position.set(x, y, z);
        local.rotation.y = rot;
        group.add(local);
        const dim = manualDim('pergola', item);
        const w = dim.w*scale, d = dim.d*scale, h = (dim.h || 2.45)*scale;
        let coords = [[-1,-1],[1,-1],[-1,1],[1,1]];
        if(item.attached){
            // Em modo anexado a parede, a face junto à casa fica sem pilares para parecer colada/encostada.
            coords = [[-1,1],[1,1]];
        }
        coords.forEach(function(c){ addBox(local,.18*scale,h,.18*scale,c[0]*w/2,h/2,c[1]*d/2,materiais.madeira,'pergola-pilar'); });
        addBox(local,w+.35,.18,.20,0,h,-d/2,materiais.madeira,'pergola-viga-casa');
        addBox(local,w+.35,.18,.20,0,h,d/2,materiais.madeira,'pergola-viga-exterior');
        addBox(local,.20,.18,d+.35,-w/2,h,0,materiais.madeira,'pergola-viga-lateral');
        addBox(local,.20,.18,d+.35,w/2,h,0,materiais.madeira,'pergola-viga-lateral');
        if(item.attached){
            addBox(local,w+.55,.16,.18,0,h+.03,-d/2-.08,materiais.madeira,'pergola-viga-iman-parede');
        }
        for(let i=-3;i<=3;i++){
            addBox(local,.12,.14,d+.55,i*w/6,h+.12,0,materiais.madeira,'pergola-ripa');
        }
    }


    function criarChurrasqueiraManual(group, x, y, z, scale, item){
        scale = scale || 1;
        item = item || {};
        const rot = item.rotY || 0;
        const local = new THREE.Group();
        local.position.set(x, y, z);
        local.rotation.y = rot;
        group.add(local);
        const dim = manualDim('churrasqueira', item);
        const w = dim.w * scale, d = dim.d * scale;
        addBox(local, w, .10, d, 0, .07, 0, materiais.betao, 'zona-churrasco-pavimento');
        addBox(local, .95*scale, 1.05*scale, .62*scale, -w*.25, .55*scale, -d*.18, materiais.pedra, 'churrasqueira-base');
        addBox(local, .78*scale, .55*scale, .52*scale, -w*.25, 1.32*scale, -d*.18, materiais.pedra, 'churrasqueira-chamine');
        addBox(local, .88*scale, .10*scale, .08*scale, -w*.25, .82*scale, .04, materiais.preto, 'grelha');
        addBox(local, Math.max(1.6,w*.40), .72*scale, .55*scale, w*.20, .38*scale, -d*.18, materiais.betao, 'bancada-churrasco');
        criarPergolaManual(local, 0, 0, .25*scale, .72*scale, {w:Math.max(3.2,w*.85), d:Math.max(2.4,d*.72), h:2.45});
    }


    function criarCarroManual(group, x, y, z, rotY){
        const body = addBox(group, 1.8, .55, 3.7, x, y+.55, z, materiais.carro, 'carro-corpo');
        body.rotation.y = rotY || 0;
        const cabin = addBox(group, 1.45, .55, 1.35, x, y+1.02, z-.35, materiais.vidro, 'carro-cabine');
        cabin.rotation.y = rotY || 0;
        const rodaGeo = new THREE.CylinderGeometry(.28,.28,.18,16);
        const offsets = [[-.82,-1.25],[.82,-1.25],[-.82,1.25],[.82,1.25]];
        offsets.forEach(function(o){
            const wheel = new THREE.Mesh(rodaGeo, materiais.preto);
            wheel.position.set(x+o[0], y+.28, z+o[1]);
            wheel.rotation.z = Math.PI/2;
            wheel.rotation.y = rotY || 0;
            group.add(wheel);
        });
    }

    function criarChafarizManual(group, x, y, z, scale){
        scale = scale || 1;
        const base = new THREE.Mesh(new THREE.CylinderGeometry(1.25*scale,1.25*scale,.22*scale,28), materiais.chafariz);
        base.position.set(x,y+.12*scale,z); base.receiveShadow = true; group.add(base);
        const agua = new THREE.Mesh(new THREE.CylinderGeometry(.92*scale,.92*scale,.08*scale,28), materiais.agua);
        agua.position.set(x,y+.30*scale,z); group.add(agua);
        const coluna = new THREE.Mesh(new THREE.CylinderGeometry(.18*scale,.24*scale,.95*scale,18), materiais.chafariz);
        coluna.position.set(x,y+.76*scale,z); coluna.castShadow = true; group.add(coluna);
        const topo = new THREE.Mesh(new THREE.SphereGeometry(.25*scale,16,12), materiais.agua);
        topo.position.set(x,y+1.28*scale,z); group.add(topo);
    }

    function criarPavimentoManual(group, x, y, z, scale, item){
        item = item || {};
        const rot = item.rotY || 0;
        const local = new THREE.Group();
        local.position.set(x, y, z);
        local.rotation.y = rot;
        group.add(local);
        const dim = manualDim('pavimento', item);
        const w = dim.w * (scale || 1), d = dim.d * (scale || 1);
        addBox(local, w, .08, d, 0, .055, 0, materiais.betao, 'pavimento-manual');
        addBox(local, w + .12, .045, .08, 0, .12, -d/2, materiais.pedra, 'pavimento-remate');
        addBox(local, w + .12, .045, .08, 0, .12, d/2, materiais.pedra, 'pavimento-remate');
        addBox(local, .08, .045, d + .12, -w/2, .12, 0, materiais.pedra, 'pavimento-remate');
        addBox(local, .08, .045, d + .12, w/2, .12, 0, materiais.pedra, 'pavimento-remate');
    }


    function criarCaminhoManual(group, x, y, z, scale, item){
        item = item || {};
        const dim = manualDim('caminho', item);
        const w = dim.w * (scale || 1), d = dim.d * (scale || 1);
        const rot = item.rotY || 0;
        const slab = addBox(group, w, .075, d, x, y + .055, z, materiais.betao, 'caminho-manual');
        slab.rotation.y = rot;
        for(let i=-2;i<=2;i++){
            const junta = addBox(group, w + .02, .025, .035, x, y + .105, z + i*d/5, materiais.pedra, 'junta-caminho');
            junta.rotation.y = rot;
        }
    }

    function criarVarandaManual(group, m){
        const w = Number(m.w || 3.2);
        const d = Number(m.d || 1.35);
        const face = m.face || 'frente';
        const y = isFinite(m.y) ? m.y : 3.25;
        let x = m.x, z = m.z;
        let slabW = w, slabD = d;
        if(face === 'esq' || face === 'dir'){
            slabW = d; slabD = w;
        }
        addBox(group, slabW, .18, slabD, x, y, z, materiais.betao, 'varanda-laje');
        const guardY = y + .62;
        if(face === 'frente' || face === 'tras'){
            const outZ = z + (face === 'frente' ? slabD/2 : -slabD/2);
            addBox(group, slabW, .9, .08, x, guardY, outZ, materiais.vidro, 'guarda-varanda');
            addBox(group, .08, .9, slabD, x - slabW/2, guardY, z, materiais.vidro, 'guarda-varanda-lat');
            addBox(group, .08, .9, slabD, x + slabW/2, guardY, z, materiais.vidro, 'guarda-varanda-lat');
        }else{
            const outX = x + (face === 'dir' ? slabW/2 : -slabW/2);
            addBox(group, .08, .9, slabD, outX, guardY, z, materiais.vidro, 'guarda-varanda');
            addBox(group, slabW, .9, .08, x, guardY, z - slabD/2, materiais.vidro, 'guarda-varanda-lat');
            addBox(group, slabW, .9, .08, x, guardY, z + slabD/2, materiais.vidro, 'guarda-varanda-lat');
        }
    }

    function criarTelhadoManualSimples(group, w, d, x, z, topY, tipo){
        tipo = tipo || 'uma_agua';
        if(tipo === 'plano'){
            addBox(group, w + .35, .20, d + .35, x, topY + .10, z, materiais.telheadoEscuro, 'telhado-anexo-extra-plano');
            return;
        }
        if(tipo === 'sandwich'){
            const roof = addBox(group, w + .55, .16, d + .55, x, topY + .25, z, materiais.telheadoEscuro, 'telhado-anexo-extra-sandwich');
            roof.rotation.x = deg(-5);
            return;
        }
        if(tipo === 'duas_aguas' || tipo === 'beiral'){
            const hw=w/2+.35, hd=d/2+.35, rise=1.0;
            const verts=[-hw,topY,-hd, hw,topY,-hd, -hw,topY,hd, hw,topY,hd, 0,topY+rise,-hd, 0,topY+rise,hd];
            const faces=[0,4,5, 0,5,2, 1,3,5, 1,5,4, 0,1,4, 2,5,3];
            const geo=new THREE.BufferGeometry(); geo.setAttribute('position',new THREE.Float32BufferAttribute(verts,3)); geo.setIndex(faces); geo.computeVertexNormals();
            const mesh=new THREE.Mesh(geo,materiais.telheado); mesh.position.set(x,0,z); mesh.castShadow=QUALITY!=='mobile'; group.add(mesh);
            return;
        }
        const roof = addBox(group, w + .50, .16, d + .50, x, topY + .32, z, materiais.telheado, 'telhado-anexo-extra-uma-agua');
        roof.rotation.x = deg(-7);
    }

    function criarAnexoLivreManual(group, x, y, z, scale, item){
        item = item || {};
        const rot = item.rotY || 0;
        const local = new THREE.Group();
        local.position.set(x, y, z);
        local.rotation.y = rot;
        group.add(local);
        const dim = manualDim('anexo_extra', item);
        const w = dim.w * (scale || 1), d = dim.d * (scale || 1), h = (dim.h || 2.75) * (scale || 1);
        addBox(local, w, h, d, 0, h/2, 0, materiais.parede, 'anexo-extra-corpo');
        criarTelhadoManualSimples(local, w, d, 0, 0, h, item.telhado || dim.telhado || 'uma_agua');
        addPlane(local, .85, 1.9, -w*.22, .98, d/2 + .035, 0, materiais.porta, 'porta-anexo-extra');
        addPlane(local, 1.0, 1.0, w*.20, 1.55, d/2 + .035, 0, materiais.janela, 'janela-anexo-extra');
    }


    function criarUnidadeClimatizacao(group, x, y, z, rotY){
        const corpo = addBox(group, 1.15, .62, .38, x, y, z, materiais.pedra, 'unidade-climatizacao');
        corpo.rotation.y = rotY || 0;
        const grelha = addPlane(group, .78, .36, x, y, z + .205, 0, materiais.preto, 'grelha-climatizacao');
        grelha.rotation.y = rotY || 0;
    }

    function criarClimatizacao(cfg, lote, fp, posCasa){
        if(!cfg || cfg.climatizacao === 'nenhuma'){ return; }
        const unidades = cfg.climatizacao === 'completa' ? 3 : (cfg.climatizacao === 'condutas' ? 2 : 1);
        for(let i=0;i<unidades;i++){
            const x = posCasa.x + fp.w/2 + .32;
            const z = posCasa.z - fp.d*.25 + i * Math.min(2.1, fp.d/(unidades+1));
            criarUnidadeClimatizacao(grupoConstrucao, x, .70, z, Math.PI/2);
        }
        if(cfg.climatizacao === 'condutas' || cfg.climatizacao === 'completa'){
            addBox(grupoConstrucao, fp.w*.72, .18, .32, posCasa.x, Math.max(3.2, cfg.andares*3.0 + .55), posCasa.z - fp.d*.18, materiais.preto, 'equipamento-cobertura-climatizacao');
        }
    }


    function criarAberturaManual(group, m, tipo){
        const mat = tipo === 'porta' ? materiais.porta : materiais.janela;
        const w = tipo === 'porta' ? 1.0 : 1.15;
        const h = tipo === 'porta' ? 2.1 : 1.05;
        const y = isFinite(m.y) ? m.y : (tipo === 'porta' ? 1.05 : 1.75);
        addPlane(group, w, h, m.x, y, m.z, m.rotY || 0, mat, tipo === 'porta' ? 'porta-extra' : 'janela-extra');
    }

    function criarChamineManual(group, m){
        const y = isFinite(m.y) ? m.y : 4.0;
        addBox(group, .48, 1.05, .48, m.x, y + .52, m.z, materiais.fachadaPedra || materiais.pedra, 'chamine');
        addBox(group, .62, .14, .62, m.x, y + 1.10, m.z, materiais.preto, 'chamine-topo');
        addBox(group, .16, .26, .16, m.x - .14, y + 1.28, m.z, materiais.preto, 'chamine-saida');
        addBox(group, .16, .26, .16, m.x + .14, y + 1.28, m.z, materiais.preto, 'chamine-saida');
    }

    function manualDim(tipo, src){
        const cfg = ultimoCfg || lerCfg();
        const scale = src && isFinite(src.scale) ? Number(src.scale) : 1;
        if(tipo === 'deck'){ return {w:(src && src.w) || cfg.deckLargura || 5.2, d:(src && src.d) || cfg.deckProfundidade || 3.2}; }
        if(tipo === 'pergola'){ return {w:(src && src.w) || cfg.pergolaLargura || 4.8, d:(src && src.d) || cfg.pergolaProfundidade || 3.3, h:(src && src.h) || cfg.pergolaAltura || 2.45}; }
        if(tipo === 'churrasqueira'){ return {w:(src && src.w) || cfg.churrascoLargura || 3.6, d:(src && src.d) || cfg.churrascoProfundidade || 2.5}; }
        if(tipo === 'candeeiro'){ return {w:1.2*scale,d:1.2*scale}; }
        if(tipo === 'planta' || tipo === 'pedra' || tipo === 'rocha'){ return {w:1.3*scale,d:1.3*scale}; }
        if(tipo === 'carro'){ return {w:2.1,d:4.4}; }
        if(tipo === 'chafariz'){ return {w:2.8,d:2.8}; }
        if(tipo === 'chamine'){ return {w:.9,d:.9}; }
        if(tipo === 'janela_extra'){ return {w:1.15,d:.25}; }
        if(tipo === 'porta_extra'){ return {w:1.05,d:.35}; }
        if(tipo === 'varanda_extra'){ return {w:(src && src.w) || cfg.varandaLargura || 3.2, d:(src && src.d) || cfg.varandaProfundidade || 1.35}; }
        if(tipo === 'anexo_extra'){ return {w:(src && src.w) || cfg.anexoExtraLargura || 6, d:(src && src.d) || cfg.anexoExtraProfundidade || 4.2, h:(src && src.h) || cfg.anexoExtraAltura || 2.75, telhado:(src && src.telhado) || cfg.anexoExtraTelhado || 'uma_agua'}; }
        if(tipo === 'pavimento'){ return {w:(src && src.w) || cfg.pavimentoLargura || 5, d:(src && src.d) || cfg.pavimentoProfundidade || 3}; }
        if(tipo === 'caminho'){ return {w:(src && src.w) || cfg.caminhoLargura || 1.4, d:(src && src.d) || cfg.caminhoComprimento || 6}; }
        return {w:2.2*scale,d:2.2*scale};
    }


    function manualRect(m){
        const dim = manualDim(m.tipo, m);
        const sc = Number(m.scale || 1);
        return rectManualRot('Manual ' + m.tipo, m.x, m.z, (dim.w || 1) * sc, (dim.d || 1) * sc, m.rotY || 0);
    }


    function recriarManuais(cfg, lote){
        disposeGroup(grupoManuais);
        const validados = [];
        for(let i=0;i<manuais.length;i++){
            const m = manuais[i];
            if(!m || !m.tipo || !isFinite(m.x) || !isFinite(m.z)){ continue; }
            const isWallTool = m.tipo === 'janela_extra' || m.tipo === 'porta_extra' || m.tipo === 'varanda_extra';
            const isRoofTool = m.tipo === 'chamine';
            const r = manualRect(m);
            if(!isWallTool && !isRoofTool && !insideLotRect(r, lote, 1.2)){ continue; }
            let colide = false;
            if(!isWallTool && !isRoofTool){
                for(let j=0;j<objetosOcupados.length;j++){
                    if(intersectRect(r, objetosOcupados[j], .75)){ colide = true; break; }
                }
            }
            if(colide){ continue; }
            const y = isFinite(m.yOffset) ? Number(m.yOffset) : 0;
            const startChild = grupoManuais.children.length;
            if(m.tipo === 'arvore'){ criarArvore(grupoManuais, m.x, y, m.z, 'arvore', m.scale || 1); }
            if(m.tipo === 'palmeira'){ criarArvore(grupoManuais, m.x, y, m.z, 'palmeira', m.scale || 1); }
            if(m.tipo === 'candeeiro'){ criarCandeeiro(grupoManuais, m.x, y, m.z); }
            if(m.tipo === 'rocha' || m.tipo === 'pedra'){ criarRocha(grupoManuais, m.x, y, m.z); }
            if(m.tipo === 'planta'){ criarPlanta(grupoManuais, m.x, y, m.z, m.scale || 1); }
            if(m.tipo === 'deck'){ criarDeckManual(grupoManuais, m.x, y, m.z, m.scale || 1, m); }
            if(m.tipo === 'pavimento'){ criarPavimentoManual(grupoManuais, m.x, y, m.z, m.scale || 1, m); }
            if(m.tipo === 'caminho'){ criarCaminhoManual(grupoManuais, m.x, y, m.z, m.scale || 1, m); }
            if(m.tipo === 'pergola'){ criarPergolaManual(grupoManuais, m.x, y, m.z, m.scale || 1, m); }
            if(m.tipo === 'churrasqueira'){ criarChurrasqueiraManual(grupoManuais, m.x, y, m.z, m.scale || 1, m); }
            if(m.tipo === 'anexo_extra'){ criarAnexoLivreManual(grupoManuais, m.x, y, m.z, m.scale || 1, m); }
            if(m.tipo === 'carro'){ criarCarroManual(grupoManuais, m.x, y, m.z, m.rotY || 0); }
            if(m.tipo === 'chafariz'){ criarChafarizManual(grupoManuais, m.x, y, m.z, m.scale || 1); }
            if(m.tipo === 'janela_extra'){ criarAberturaManual(grupoManuais, m, 'janela'); }
            if(m.tipo === 'porta_extra'){ criarAberturaManual(grupoManuais, m, 'porta'); }
            if(m.tipo === 'varanda_extra'){ criarVarandaManual(grupoManuais, m); }
            if(m.tipo === 'chamine'){ criarChamineManual(grupoManuais, m); }
            for(let c=startChild; c<grupoManuais.children.length; c++){
                grupoManuais.children[c].userData.manualIndex = validados.length;
                grupoManuais.children[c].userData.manualTipo = m.tipo;
            }
            if(!isWallTool && !isRoofTool && m.tipo !== 'varanda_extra'){ objetosOcupados.push(r); }
            validados.push(m);
        }
        manuais = validados;
    }



    function ferramentaPermiteRotacao(tool){
        return ['deck','pavimento','caminho','pergola','churrasqueira','anexo_extra','carro','chafariz','arvore','palmeira','planta','pedra','rocha','candeeiro'].indexOf(tool) >= 0;
    }

    function rotacaoAtualFerramenta(tool){
        if(!tool || !ferramentaPermiteRotacao(tool)){ return 0; }
        return rotacoesFerramenta[tool] || 0;
    }

    function rectDimRot(w,d,rot){
        rot = rot || 0;
        const c = Math.abs(Math.cos(rot));
        const sn = Math.abs(Math.sin(rot));
        return {w:(w*c)+(d*sn), d:(w*sn)+(d*c)};
    }

    function rectManualRot(nome, x, z, w, d, rot){
        const rd = rectDimRot(w || 1, d || 1, rot || 0);
        return rect(nome || 'manual', x, z, rd.w, rd.d);
    }

    function atualizarPreviewPorUltimoPonto(){
        if(!ferramentaAtual || !ultimoPontoTerreno){ return; }
        const cfg = ultimoCfg || lerCfg();
        const lote = loteDimensoes(cfg);
        let avaliacao;
        if(ferramentaAtual === 'mover_piscina' || ferramentaAtual === 'mover_anexo' || ferramentaAtual === 'apagar_extra'){
            return;
        }
        avaliacao = avaliarColocacao(ultimoPontoTerreno.x, ultimoPontoTerreno.z, ferramentaAtual, cfg, lote);
        ultimoPontoPreview = avaliacao;
        desenharPreview(avaliacao);
    }

    function onWheelFerramenta(ev){
        // O scroll fica livre para o zoom normal do OrbitControls.
        // A rotação dos objetos passou para a tecla R.
        return;
    }

    function ferramentaPermiteOffsetVertical(tool){
        return ['deck','pavimento','caminho','pergola','churrasqueira','anexo_extra','carro','chafariz','arvore','palmeira','planta','pedra','rocha','candeeiro'].indexOf(tool) >= 0;
    }

    function aplicarOffsetPonto(p){
        if(!p){ return null; }
        return {x:p.x + offsetColocacao.x, y:p.y || 0, z:p.z + offsetColocacao.z};
    }

    function rodarFerramentaAtual(sentido, fino){
        if(!ferramentaAtual || !ferramentaPermiteRotacao(ferramentaAtual)){ return; }
        const passo = deg(fino ? 5 : 15) * (sentido || 1);
        const atual = rotacaoAtualFerramenta(ferramentaAtual);
        rotacoesFerramenta[ferramentaAtual] = atual + passo;
        atualizarPreviewPorUltimoPonto();
    }

    function moverCursorFerramenta(dx, dz){
        if(!ferramentaAtual){ return; }
        offsetColocacao.x += dx;
        offsetColocacao.z += dz;
        atualizarPreviewPorUltimoPonto();
    }

    function ajustarAlturaFerramenta(delta){
        if(!ferramentaAtual || !ferramentaPermiteOffsetVertical(ferramentaAtual)){ return; }
        offsetColocacao.y = clamp(offsetColocacao.y + delta, -2.5, 8);
        atualizarPreviewPorUltimoPonto();
    }

    function onKeyFerramenta(ev){
        if(!ferramentaAtual){ return; }
        const tag = (ev.target && ev.target.tagName ? ev.target.tagName : '').toLowerCase();
        if(tag === 'input' || tag === 'select' || tag === 'textarea'){ return; }
        const k = ev.key.toLowerCase();
        const passo = ev.altKey ? .25 : (ev.shiftKey ? .5 : 1.0);
        if(k === 'r'){
            ev.preventDefault();
            rodarFerramentaAtual(ev.shiftKey ? -1 : 1, ev.altKey);
            return;
        }
        if(k === 'w' || k === 'arrowup'){ ev.preventDefault(); moverCursorFerramenta(0, -passo); return; }
        if(k === 's' || k === 'arrowdown'){ ev.preventDefault(); moverCursorFerramenta(0, passo); return; }
        if(k === 'a' || k === 'arrowleft'){ ev.preventDefault(); moverCursorFerramenta(-passo, 0); return; }
        if(k === 'd' || k === 'arrowright'){ ev.preventDefault(); moverCursorFerramenta(passo, 0); return; }
        if(k === 'shift'){ ev.preventDefault(); ajustarAlturaFerramenta(.25); return; }
        if(k === 'control'){ ev.preventDefault(); ajustarAlturaFerramenta(-.25); return; }
        if(k === 'escape'){
            ev.preventDefault();
            setFerramentaAtual(null);
            return;
        }
    }

    function pontoDentroLote(x,z,lote,margin){
        return pontoDentroLotePoligono(x, z, lote, margin || 0);
    }

    function pontoLivre(x,z,tipo,ignorarNomes){
        const dim = manualDim(tipo || 'arvore');
        const p = rect('manual', x, z, dim.w, dim.d);
        if(!ultimoCfg){ ultimoCfg = lerCfg(); }
        const lote = loteDimensoes(ultimoCfg);
        if(!insideLotRect(p, lote, 1.2)){ return false; }
        const ignorar = ignorarNomes || [];
        for(let i=0;i<objetosOcupados.length;i++){
            const nome = objetosOcupados[i].name || '';
            if(ignorar.indexOf(nome) >= 0){ continue; }
            if(intersectRect(p, objetosOcupados[i], .8)){ return false; }
        }
        return true;
    }

    function setFerramentaAtual(tool){
        ferramentaAtual = ferramentaAtual === tool ? null : tool;
        offsetColocacao = {x:0, z:0, y:0};
        qsa('[data-tool]').forEach(function(b){ b.classList.toggle('ativo', b.getAttribute('data-tool') === ferramentaAtual); });
        const main = $('btn-ferramentas-3d');
        if(main){ main.classList.toggle('ativo', !!ferramentaAtual); }
        limparPreview();
    }

    function setCategoriaFerramenta(cat){
        categoriaFerramentaAtual = categoriaFerramentaAtual === cat ? null : cat;
        const box = $('canvas-tools');
        if(box){ box.classList.toggle('aberto', !!categoriaFerramentaAtual); }
        qsa('[data-tool-category]').forEach(function(b){ b.classList.toggle('ativo', b.getAttribute('data-tool-category') === categoriaFerramentaAtual); });
        qsa('[data-tool-panel]').forEach(function(p){ p.classList.toggle('ativo', p.getAttribute('data-tool-panel') === categoriaFerramentaAtual); });
    }


    function obterPontoTerrenoDoEvento(ev){
        if(!camara || !renderizador){ return null; }
        const holder = $('canvas-container');
        if(!holder){ return null; }
        const rectDom = holder.getBoundingClientRect();
        rato.x = ((ev.clientX - rectDom.left) / rectDom.width) * 2 - 1;
        rato.y = -((ev.clientY - rectDom.top) / rectDom.height) * 2 + 1;
        raycaster.setFromCamera(rato, camara);
        const alvo = loteMesh || terrenoMesh;
        if(!alvo){ return null; }
        const inters = raycaster.intersectObject(alvo, false);
        if(!inters.length){ return null; }
        return inters[0].point;
    }

    function obterManualDoEvento(ev){
        if(!camara || !renderizador || !grupoManuais.children.length){ return null; }
        const holder = $('canvas-container');
        if(!holder){ return null; }
        const rectDom = holder.getBoundingClientRect();
        rato.x = ((ev.clientX - rectDom.left) / rectDom.width) * 2 - 1;
        rato.y = -((ev.clientY - rectDom.top) / rectDom.height) * 2 + 1;
        raycaster.setFromCamera(rato, camara);
        const hits = raycaster.intersectObjects(grupoManuais.children, true);
        for(let i=0;i<hits.length;i++){
            let obj = hits[i].object;
            while(obj){
                if(obj.userData && typeof obj.userData.manualIndex === 'number'){
                    const idx = obj.userData.manualIndex;
                    if(manuais[idx]){ return {index:idx, item:manuais[idx], object:hits[i].object}; }
                }
                obj = obj.parent;
            }
        }
        return null;
    }

    function apagarExtraPorIndice(idx){
        if(typeof idx !== 'number' || idx < 0 || idx >= manuais.length){ return false; }
        const apagado = manuais.splice(idx, 1)[0];
        atualizarGeometria(false);
        mostrarModal('Extra removido', 'Foi removido apenas o elemento selecionado: ' + (apagado && apagado.tipo ? apagado.tipo : 'extra') + '.', [{texto:'OK', tipo:'primary'}]);
        return true;
    }


    function nomesConstrucoesParaSnap(){
        return ['Casa principal','Vivenda','Garagem','Anexo'];
    }

    function isNomeConstrução(nome){
        nome = nome || '';
        return nome.indexOf('Casa') >= 0 || nome.indexOf('Vivenda') >= 0 || nome.indexOf('Garagem') >= 0 || nome.indexOf('Anexo') >= 0;
    }

    function snapParede(x,z, apenasCasa){
        let melhor = null;
        const maxDist = apenasCasa ? 4.8 : 2.0;
        for(let i=0;i<objetosOcupados.length;i++){
            const o = objetosOcupados[i];
            const nome = o.name || '';
            if(apenasCasa){
                if(nome.indexOf('Casa') < 0 && nome.indexOf('Vivenda') < 0){ continue; }
            }else if(!isNomeConstrução(nome)){ continue; }
            const checks = [
                {face:'frente', dist:Math.abs(z-o.maxZ), ok:x>=o.minX-.5 && x<=o.maxX+.5, x:clamp(x,o.minX+.8,o.maxX-.8), z:o.maxZ+.06, rotY:0},
                {face:'tras', dist:Math.abs(z-o.minZ), ok:x>=o.minX-.5 && x<=o.maxX+.5, x:clamp(x,o.minX+.8,o.maxX-.8), z:o.minZ-.06, rotY:Math.PI},
                {face:'esq', dist:Math.abs(x-o.minX), ok:z>=o.minZ-.5 && z<=o.maxZ+.5, x:o.minX-.06, z:clamp(z,o.minZ+.8,o.maxZ-.8), rotY:-Math.PI/2},
                {face:'dir', dist:Math.abs(x-o.maxX), ok:z>=o.minZ-.5 && z<=o.maxZ+.5, x:o.maxX+.06, z:clamp(z,o.minZ+.8,o.maxZ-.8), rotY:Math.PI/2}
            ];
            checks.forEach(function(c){
                if(!c.ok || c.dist > maxDist){ return; }
                if(!melhor || c.dist < melhor.dist){ melhor = Object.assign({rect:o}, c); }
            });
        }
        return melhor;
    }

    function snapPergola(x,z,dim){
        const wall = snapParede(x,z,true);
        if(!wall){ return null; }
        const w = dim.w || 4.8;
        const d = dim.d || 3.3;
        let px = x, pz = z, rotY = 0;
        if(wall.face === 'frente'){
            px = clamp(x, wall.rect.minX + w/2 + .2, wall.rect.maxX - w/2 - .2);
            pz = wall.rect.maxZ + d/2 + .08;
            rotY = 0;
        }else if(wall.face === 'tras'){
            px = clamp(x, wall.rect.minX + w/2 + .2, wall.rect.maxX - w/2 - .2);
            pz = wall.rect.minZ - d/2 - .08;
            rotY = Math.PI;
        }else if(wall.face === 'esq'){
            px = wall.rect.minX - d/2 - .08;
            pz = clamp(z, wall.rect.minZ + w/2 + .2, wall.rect.maxZ - w/2 - .2);
            rotY = -Math.PI/2;
        }else if(wall.face === 'dir'){
            px = wall.rect.maxX + d/2 + .08;
            pz = clamp(z, wall.rect.minZ + w/2 + .2, wall.rect.maxZ - w/2 - .2);
            rotY = Math.PI/2;
        }
        return {x:px,z:pz,attached:true,face:wall.face,rotY:rotY,ignoreName:wall.rect.name};
    }

    function snapChamine(x,z,cfg){
        let alvo = null;
        let best = Infinity;
        for(let i=0;i<objetosOcupados.length;i++){
            const o = objetosOcupados[i];
            const nome = o.name || '';
            if(nome.indexOf('Casa') < 0 && nome.indexOf('Vivenda') < 0){ continue; }
            const cx = clamp(x, o.minX + 1.4, o.maxX - 1.4);
            const cz = clamp(z, o.minZ + 1.4, o.maxZ - 1.4);
            const dist = Math.hypot(x-cx, z-cz);
            if(dist < best){ best = dist; alvo = Object.assign({cx:cx, cz:cz}, o); }
        }
        if(!alvo || best > 5.0){ return null; }
        const pe = cfg.tipo === 'predio' ? 3.05 : 3.0;
        const topY = pe * Math.max(1, cfg.andares);
        const relX = alvo.cx - alvo.x;
        const relZ = alvo.cz - alvo.z;
        const rise = cfg.telhado === 'plano' ? 0 : inclinacaoValor(cfg);
        const roofType = cfg.telhado === 'beiral' ? 'duas_aguas' : (cfg.telhado === 'sandwich' ? 'uma_agua' : cfg.telhado);
        const y = alturaNoTelhado(roofType, cfg.orientacaoTelhado || 'frente_tras', relX, relZ, alvo.w || (alvo.maxX-alvo.minX), alvo.d || (alvo.maxZ-alvo.minZ), topY + .05, rise) + .08;
        return {x:alvo.cx,z:alvo.cz,y:y};
    }

    function snapPavimentoAoExistente(x,z,dim,rotY){
        if(!dim || Math.abs(Math.sin(rotY || 0)) > .2){ return null; }
        const w = dim.w || 5;
        const d = dim.d || 3;
        let melhor = null;
        const limite = .85;
        manuais.forEach(function(m){
            if(!m || (m.tipo !== 'pavimento' && m.tipo !== 'caminho' && m.tipo !== 'deck')){ return; }
            const r = manualRect(m);
            const candidatos = [
                {x:r.maxX + w/2, z:clamp(z, r.minZ + d/2, r.maxZ - d/2), dist:Math.abs((x - w/2) - r.maxX)},
                {x:r.minX - w/2, z:clamp(z, r.minZ + d/2, r.maxZ - d/2), dist:Math.abs((x + w/2) - r.minX)},
                {x:clamp(x, r.minX + w/2, r.maxX - w/2), z:r.maxZ + d/2, dist:Math.abs((z - d/2) - r.maxZ)},
                {x:clamp(x, r.minX + w/2, r.maxX - w/2), z:r.minZ - d/2, dist:Math.abs((z + d/2) - r.minZ)}
            ];
            candidatos.forEach(function(c){
                if(c.dist <= limite && (!melhor || c.dist < melhor.dist)){ melhor = c; }
            });
        });
        return melhor;
    }

    function avaliarColocacao(x,z,tool,cfg,lote){
        const dim = manualDim(tool, null);
        let rotY = rotacaoAtualFerramenta(tool);
        let item = {tipo:tool, x:x, z:z, scale:1, rotY:rotY, yOffset: offsetColocacao.y || 0};
        let r = rectManualRot('Manual ' + tool, x, z, dim.w || 1, dim.d || 1, rotY);
        let ignorar = [];
        if(tool === 'pergola'){
            const snap = snapPergola(x,z,dim);
            if(snap){
                item.x = snap.x; item.z = snap.z; item.attached = true; item.face = snap.face; item.rotY = snap.rotY || 0; item.w = dim.w; item.d = dim.d; item.h = dim.h;
                r = rectManualRot('Manual ' + tool, item.x, item.z, dim.w, dim.d, item.rotY);
                if(snap.ignoreName){ ignorar.push(snap.ignoreName); }
            }else{
                item.w = dim.w; item.d = dim.d; item.h = dim.h;
                r = rectManualRot('Manual ' + tool, item.x, item.z, dim.w, dim.d, item.rotY);
            }
        }
        if(tool === 'deck' || tool === 'pavimento' || tool === 'caminho'){
            item.w = dim.w; item.d = dim.d;
            if(tool === 'pavimento'){
                const snapPav = snapPavimentoAoExistente(item.x, item.z, dim, item.rotY);
                if(snapPav){ item.x = snapPav.x; item.z = snapPav.z; }
            }
            r = rectManualRot('Manual ' + tool, item.x, item.z, dim.w, dim.d, item.rotY);
        }
        if(tool === 'churrasqueira'){
            item.w = dim.w; item.d = dim.d;
            r = rectManualRot('Manual ' + tool, item.x, item.z, dim.w, dim.d, item.rotY);
        }
        if(tool === 'anexo_extra'){
            item.w = dim.w; item.d = dim.d; item.h = dim.h; item.telhado = dim.telhado || cfg.anexoExtraTelhado || 'uma_agua';
            r = rectManualRot('Manual ' + tool, item.x, item.z, dim.w, dim.d, item.rotY);
        }
        if(tool === 'varanda_extra'){
            const snap = snapParede(x,z,false);
            if(!snap){ return {ok:false, item:item, rect:r, reason:'A varanda tem de ser colocada junto a uma parede da casa, garagem ou anexo.'}; }
            item.face = snap.face; item.w = dim.w; item.d = dim.d; item.y = cfg.andares > 1 ? 3.12 : 2.15;
            const out = dim.d/2 + .12;
            if(snap.face === 'frente'){ item.x = snap.x; item.z = snap.z + out; r = rect('Varanda', item.x, item.z, dim.w, dim.d); }
            else if(snap.face === 'tras'){ item.x = snap.x; item.z = snap.z - out; r = rect('Varanda', item.x, item.z, dim.w, dim.d); }
            else if(snap.face === 'esq'){ item.x = snap.x - out; item.z = snap.z; r = rect('Varanda', item.x, item.z, dim.d, dim.w); }
            else{ item.x = snap.x + out; item.z = snap.z; r = rect('Varanda', item.x, item.z, dim.d, dim.w); }
            if(!insideLotRect(r, lote, 1.2)){ return {ok:false, item:item, rect:r, reason:'A varanda ficaria fora do lote.'}; }
            for(let i=0;i<objetosOcupados.length;i++){
                const nome = objetosOcupados[i].name || '';
                if(nome === snap.rect.name){ continue; }
                if(intersectRect(r, objetosOcupados[i], .75)){ return {ok:false, item:item, rect:r, reason:'A varanda colide com outro elemento.'}; }
            }
            return {ok:true, item:item, rect:r, wall:true};
        }
        if(tool === 'janela_extra' || tool === 'porta_extra'){
            const snap = snapParede(x,z,false);
            if(!snap){ return {ok:false, item:item, rect:r, reason:'A janela/porta tem de ser colocada junto a uma parede existente.'}; }
            item.x = snap.x; item.z = snap.z; item.rotY = snap.rotY; item.y = tool === 'porta_extra' ? 1.08 : 1.78;
            return {ok:true, item:item, rect:rect('Abertura', item.x, item.z, 1.2, 1.2), wall:true};
        }
        if(tool === 'chamine'){
            const snap = snapChamine(x,z,cfg);
            if(!snap){ return {ok:false, item:item, rect:r, reason:'A chaminé tem de ser colocada sobre a casa.'}; }
            item.x = snap.x; item.z = snap.z; item.y = snap.y;
            return {ok:true, item:item, rect:rect('Chaminé', item.x, item.z, 1, 1), roof:true};
        }
        if(!insideLotRect(r, lote, 1.2)){ return {ok:false, item:item, rect:r, reason:'O elemento tem de ficar dentro do lote.'}; }
        for(let i=0;i<objetosOcupados.length;i++){
            const nome = objetosOcupados[i].name || '';
            if(ignorar.indexOf(nome) >= 0){ continue; }
            if(intersectRect(r, objetosOcupados[i], .85)){ return {ok:false, item:item, rect:r, reason:'Existe colisão com outro elemento.'}; }
        }
        return {ok:true, item:item, rect:r};
    }

    function limparPreview(){
        disposeGroup(grupoPreview);
        ultimoPontoPreview = null;
    }

    function desenharPreview(avaliacao){
        disposeGroup(grupoPreview);
        if(!avaliacao || !avaliacao.rect){ return; }
        const r = avaliacao.rect;
        const mat = avaliacao.ok ? materiais.previewOk : materiais.previewBad;
        const h = avaliacao.wall ? 1.65 : (avaliacao.roof ? .35 : .12);
        const y = (avaliacao.wall ? 1.45 : (avaliacao.roof ? (avaliacao.item.y || 3) : .18)) + ((avaliacao.item && avaliacao.item.yOffset) ? Number(avaliacao.item.yOffset) : 0);
        const baseW = avaliacao.item && isFinite(avaliacao.item.w) ? Number(avaliacao.item.w) : r.w;
        const baseD = avaliacao.item && isFinite(avaliacao.item.d) ? Number(avaliacao.item.d) : r.d;
        const mesh = new THREE.Mesh(new THREE.BoxGeometry(Math.max(.3,baseW), h, Math.max(.3,baseD)), mat);
        mesh.position.set(r.x, y, r.z);
        if(avaliacao.item && isFinite(avaliacao.item.rotY)){ mesh.rotation.y = avaliacao.item.rotY; }
        mesh.name = 'preview-colocacao';
        grupoPreview.add(mesh);
    }

    function onPointerMove(ev){
        if(!ferramentaAtual){ limparPreview(); return; }
        if(ferramentaAtual === 'apagar_extra'){
            const hit = obterManualDoEvento(ev);
            if(hit && hit.item){
                const r = manualRect(hit.item);
                desenharPreview({ok:false, rect:r, item:hit.item});
            }else{ limparPreview(); }
            return;
        }
        let p = obterPontoTerrenoDoEvento(ev);
        if(!p){ limparPreview(); return; }
        p = aplicarOffsetPonto(p);
        ultimoPontoTerreno = {x:p.x - offsetColocacao.x, z:p.z - offsetColocacao.z};
        const cfg = ultimoCfg || lerCfg();
        const lote = loteDimensoes(cfg);
        let avaliacao;
        if(ferramentaAtual === 'mover_piscina'){
            const comp = safeNumber('piscina-comprimento', 8, 4, 30);
            const larg = safeNumber('piscina-largura', 4, 2.5, 15);
            const r = rect('Piscina', p.x, p.z, comp + 2, larg + 2);
            let ok = insideLotRect(r, lote, 1.4);
            if(ok){
                for(let i=0;i<objetosOcupados.length;i++){
                    if(objetosOcupados[i].name === 'Piscina'){ continue; }
                    if(intersectRect(r, objetosOcupados[i], 1.0)){ ok = false; break; }
                }
            }
            avaliacao = {ok:ok, rect:r, item:{x:p.x,z:p.z}};
        }else if(ferramentaAtual === 'mover_anexo'){
            const cfgAtual = lerCfg();
            const dim = dimsAnexo(cfgAtual);
            const r = rect('Anexo', p.x, p.z, dim.w, dim.d);
            let ok = cfgAtual.anexos !== 'nenhum' && insideLotRect(r, lote, 1.7);
            if(ok){
                for(let i=0;i<objetosOcupados.length;i++){
                    if(objetosOcupados[i].name === 'Anexo'){ continue; }
                    if(intersectRect(r, objetosOcupados[i], 1.05)){ ok = false; break; }
                }
            }
            avaliacao = {ok:ok, rect:r, item:{x:p.x,z:p.z}};
        }else{
            avaliacao = avaliarColocacao(p.x,p.z,ferramentaAtual,cfg,lote);
        }
        ultimoPontoPreview = avaliacao;
        desenharPreview(avaliacao);
    }

    function onPointerDown(ev){
        if(!ferramentaAtual || !camara || !renderizador){ return; }
        if(ferramentaAtual === 'apagar_extra'){
            const hit = obterManualDoEvento(ev);
            if(!hit){ mostrarModal('Nenhum extra selecionado', 'Clique diretamente sobre o extra 3D que quer remover.', [{texto:'OK', tipo:'primary'}]); return; }
            apagarExtraPorIndice(hit.index);
            return;
        }
        let p = obterPontoTerrenoDoEvento(ev);
        if(!p){ return; }
        p = aplicarOffsetPonto(p);
        const cfg = ultimoCfg || lerCfg();
        const lote = loteDimensoes(cfg);

        if(ferramentaAtual === 'mover_piscina'){
            const comp = safeNumber('piscina-comprimento', 8, 4, 30);
            const larg = safeNumber('piscina-largura', 4, 2.5, 15);
            const r = rect('Piscina', p.x, p.z, comp + 2, larg + 2);
            if(!insideLotRect(r, lote, 1.4)){
                mostrarModal('Piscina fora do lote', 'A piscina tem de ficar totalmente dentro do terreno e afastada do muro.', [{texto:'OK', tipo:'primary'}]);
                return;
            }
            for(let i=0;i<objetosOcupados.length;i++){
                if(objetosOcupados[i].name === 'Piscina'){ continue; }
                if(intersectRect(r, objetosOcupados[i], 1.0)){
                    mostrarModal('Piscina sem espaço', 'Não é possível mover a piscina para esse local porque colide com outra construção ou elemento exterior.', [{texto:'OK', tipo:'primary'}]);
                    return;
                }
            }
            const piscina = $('piscina'); if(piscina){ piscina.checked = true; }
            setValueIfExists('piscina-manual','1');
            setValueIfExists('piscina-x',p.x.toFixed(3));
            setValueIfExists('piscina-z',p.z.toFixed(3));
            atualizarGeometria(false);
            return;
        }

        if(ferramentaAtual === 'mover_anexo'){
            const cfgAtual = lerCfg();
            if(cfgAtual.anexos === 'nenhum'){
                mostrarModal('Sem anexo ativo', 'Primeiro escolha um tipo de anexo no painel esquerdo. Depois use esta ferramenta para o posicionar livremente.', [{texto:'OK', tipo:'primary'}]);
                return;
            }
            const dim = dimsAnexo(cfgAtual);
            const r = rect('Anexo', p.x, p.z, dim.w, dim.d);
            if(!insideLotRect(r, lote, 1.7)){
                mostrarModal('Anexo fora do lote', 'O anexo tem de ficar totalmente dentro do terreno e afastado do muro.', [{texto:'OK', tipo:'primary'}]);
                return;
            }
            for(let i=0;i<objetosOcupados.length;i++){
                if(objetosOcupados[i].name === 'Anexo'){ continue; }
                if(intersectRect(r, objetosOcupados[i], 1.05)){
                    mostrarModal('Anexo sem espaço', 'Não é possível colocar o anexo nesse ponto porque colide com a casa, garagem, piscina ou outro elemento exterior.', [{texto:'OK', tipo:'primary'}]);
                    return;
                }
            }
            setValueIfExists('anexo-manual','1');
            setValueIfExists('anexo-x',p.x.toFixed(3));
            setValueIfExists('anexo-z',p.z.toFixed(3));
            atualizarGeometria(false);
            return;
        }

        const avaliacao = avaliarColocacao(p.x,p.z,ferramentaAtual,cfg,lote);
        if(!avaliacao.ok){
            mostrarModal('Sem espaço nesse ponto', avaliacao.reason || 'Esse ponto não é válido para o elemento selecionado.', [{texto:'OK', tipo:'primary'}]);
            return;
        }
        const item = avaliacao.item;
        if(['deck','pavimento','caminho','pergola','churrasqueira','anexo_extra','carro','chafariz','janela_extra','porta_extra','varanda_extra','chamine'].indexOf(item.tipo) < 0){
            item.scale = .85 + Math.random()*.35;
        }
        manuais.push(item);
        atualizarGeometria(false);
    }


    function limparManuais(){
        manuais = [];
        atualizarGeometria(false);
    }

    function atualizarResumo(cfg){
        const box = $('resumo-elementos');
        if(!box){ return; }
        const items = [];
        items.push(['Terreno', fmtM2(cfg.areaTerreno)]);
        items.push(['Construção', cfg.tipo === 'vivenda' ? cfg.vivendasQtd + ' vivendas' : cfg.tipo]);
        items.push(['Estilo', cfg.estiloCasa || 'moderno']);
        items.push(['Área construída', fmtM2(areaTotalConstrucao(cfg))]);
        if(cfg.garagem !== 'nenhuma'){ items.push(['Garagem', cfg.garagem === 'subterranea' ? 'Só orçamento' : cfg.garagem]); }
        if(cfg.climatizacao && cfg.climatizacao !== 'nenhuma'){ items.push(['Climatização', cfg.climatizacao]); }
        if(cfg.tipoMuro !== 'nenhum'){ items.push(['Vedação', cfg.tipoMuro]); }
        if(cfg.anexos !== 'nenhum'){ items.push(['Anexo', cfg.anexos + ' / ' + (cfg.anexoManual ? 'posição manual' : cfg.posicaoAnexo)]); }
        if(cfg.piscina){ items.push(['Piscina', cfg.piscinaComprimento + ' x ' + cfg.piscinaLargura + ' m']); }
        if(manuais.length){
            const porTipo = {};
            manuais.forEach(function(m){ porTipo[m.tipo] = (porTipo[m.tipo] || 0) + 1; });
            const txt = Object.keys(porTipo).map(function(k){ return porTipo[k] + 'x ' + k; }).join(', ');
            items.push(['Exteriores 3D', txt]);
        }
        box.innerHTML = items.map(function(it){ return '<div class="summary-pill"><strong>' + escapeHTML(it[0]) + '</strong><span>' + escapeHTML(it[1]) + '</span></div>'; }).join('');
    }

    function calcularEstimativa(cfg){
        const area = areaTotalConstrucao(cfg);
        let precoM2 = 1180;
        if(cfg.tipo === 'predio'){ precoM2 = 1050; }
        if(cfg.tipo === 'vivenda'){ precoM2 = 1120; }
        let total = area * precoM2;
        const rubricas = [{nome:'Construção base', valor:total}];
        if(cfg.andares > 1){ const v = area * 110; rubricas.push({nome:'Estrutura de pisos superiores', valor:v}); total += v; }
        if(cfg.telhado !== 'plano'){
            const v = cfg.area * (cfg.tipo === 'vivenda' ? cfg.vivendasQtd : 1) * 70;
            rubricas.push({nome:'Cobertura inclinada / telha', valor:v}); total += v;
        }
        if(cfg.garagem === 'integrada'){ const v = 14500 + (cfg.garagemPortoes-1)*3600; rubricas.push({nome:'Garagem no mesmo edifício', valor:v}); total += v; }
        if(['colada_esq','colada_dir','colada_frente','colada_tras'].indexOf(cfg.garagem) >= 0){ const v = 23000 + (cfg.garagemPortoes-1)*3800; rubricas.push({nome:'Garagem colada à casa', valor:v}); total += v; }
        if(cfg.garagem === 'subterranea'){ const v = 58000; rubricas.push({nome:'Garagem subterrânea / cave', valor:v}); total += v; }
        if(cfg.tipoMuro !== 'nenhum'){
            const lote = loteDimensoes(cfg);
            const areaMuroAuto = (lote.w + lote.d) * 2 * 1.35;
            const am = cfg.areaMuro > 0 ? cfg.areaMuro : areaMuroAuto;
            const unit = cfg.tipoMuro === 'vegetacao' ? 55 : (cfg.tipoMuro === 'vidro' ? 155 : 90);
            const v = am * unit;
            rubricas.push({nome:'Vedação / muro', valor:v}); total += v;
        }
        if(cfg.anexos !== 'nenhum'){
            let v = 12000;
            if(cfg.anexos === 'lazer'){ v = 22500; }
            if(cfg.anexos === 'oficina'){ v = 27000 + (cfg.garagemAnexoPortoes-1)*3600; }
            if(cfg.anexos === 'garagem'){ v = 22000 + (cfg.garagemAnexoPortoes-1)*3600; }
            rubricas.push({nome:'Anexo', valor:v}); total += v;
        }
        if(cfg.piscina){ const v = cfg.piscinaComprimento * cfg.piscinaLargura * 650 + 9000; rubricas.push({nome:'Piscina', valor:v}); total += v; }
        if(cfg.paineis){ const v = 7200; rubricas.push({nome:'Painéis fotovoltaicos', valor:v}); total += v; }
        if(cfg.claraboias > 0){ const v = cfg.claraboias * 950; rubricas.push({nome:'Claraboias', valor:v}); total += v; }
        if(cfg.climatizacao && cfg.climatizacao !== 'nenhuma'){
            let v = 0;
            if(cfg.climatizacao === 'pre_ac'){ v = 1800; }
            else if(cfg.climatizacao === 'split'){ v = 4200; }
            else if(cfg.climatizacao === 'condutas'){ v = 8500; }
            else if(cfg.climatizacao === 'completa'){ v = 14500; }
            if(v){ rubricas.push({nome:'Climatização', valor:v}); total += v; }
        }
        let exterior = 0;
        manuais.forEach(function(m){
            if(m.tipo === 'deck'){ exterior += 2600; }
            else if(m.tipo === 'pergola'){ exterior += 3400; }
            else if(m.tipo === 'churrasqueira'){ exterior += 5200; }
            else if(m.tipo === 'anexo_extra'){ exterior += Math.max(9000, ((m.w || cfg.anexoExtraLargura || 6) * (m.d || cfg.anexoExtraProfundidade || 4.2)) * 650); }
            else if(m.tipo === 'varanda_extra'){ exterior += 4200; }
            else if(m.tipo === 'pavimento'){ exterior += ((m.w || cfg.pavimentoLargura || 5) * (m.d || cfg.pavimentoProfundidade || 3)) * 55; }
            else if(m.tipo === 'caminho'){ exterior += ((m.w || cfg.caminhoLargura || 1.4) * (m.d || cfg.caminhoComprimento || 6)) * 45; }
            else if(m.tipo === 'candeeiro'){ exterior += 380; }
            else if(m.tipo === 'planta'){ exterior += 45; }
            else if(m.tipo === 'carro'){ exterior += 0; }
            else{ exterior += 180; }
        });
        if(exterior){ rubricas.push({nome:'Exteriores adicionados no 3D', valor:exterior}); total += exterior; }
        return {total:total, rubricas:rubricas};
    }

    function atualizarHUD(cfg){
        const est = calcularEstimativa(cfg);
        ultimaEstimativa = est.total;
        const areaEl = $('hud-area');
        const precoEl = $('hud-preco');
        if(areaEl){ areaEl.innerText = fmtM2(areaTotalConstrucao(cfg)); }
        if(precoEl){ precoEl.innerText = fmtEUR(est.total); }
    }

    function calcularOrcamento(){
        const termos = $('termos-responsabilidade');
        if(termos && !termos.checked){
            mostrarModal('Termos necessários', 'Para gerar o relatório, é necessário aceitar os termos de responsabilidade. A estimativa é apenas indicativa e não substitui projeto técnico/orçamento formal.', [{texto:'Ler termos', acao:mostrarTermos}, {texto:'OK', tipo:'primary'}]);
            return;
        }
        const cfg = lerCfg();
        const est = calcularEstimativa(cfg);
        const modal = $('modal-orcamento');
        if(!modal){ return; }
        const linhas = est.rubricas.map(function(r){ return '<div class="line-item"><span>' + escapeHTML(r.nome) + '</span><span class="value">' + fmtEUR(r.valor) + '</span></div>'; }).join('');
        modal.innerHTML = '<div class="modal-content"><div class="modal-header"><h2>Relatório estimativo</h2><button type="button" class="btn-close" data-close="1">×</button></div>' +
            '<div class="modal-body"><div class="price-hero"><span class="price-label">Estimativa indicativa</span><h3>' + fmtEUR(est.total) + '</h3></div>' +
            '<div class="breakdown-list">' + linhas + '</div>' +
            '<div class="disclaimer-box">Valor meramente indicativo. Não dispensa consulta técnica, medições reais, projeto de arquitetura/engenharia, licenciamento, especialidades nem orçamento formal.</div>' +
            '<div class="modal-actions"><button type="button" class="btn-modal" data-copy="1">Copiar resumo</button><button type="button" class="btn-modal primary" data-close="1">Fechar</button></div></div></div>';
        modal.classList.add('ativo');
        modal.querySelectorAll('[data-close]').forEach(function(b){ b.addEventListener('click', function(){ modal.classList.remove('ativo'); }); });
        const copy = modal.querySelector('[data-copy]');
        if(copy){ copy.addEventListener('click', function(){ copiarResumo(cfg, est); }); }
    }

    function copiarResumo(cfg, est){
        const texto = 'R.F. CARVALHO - Simulação\n' +
            'Tipo: ' + cfg.tipo + '\n' +
            'Área construída: ' + fmtM2(areaTotalConstrucao(cfg)) + '\n' +
            'Terreno: ' + fmtM2(cfg.areaTerreno) + '\n' +
            'Estimativa: ' + fmtEUR(est.total) + '\n' +
            'Nota: valor meramente indicativo.';
        if(navigator.clipboard){ navigator.clipboard.writeText(texto); }
        mostrarModal('Resumo copiado', 'O resumo foi copiado para a área de transferência.', [{texto:'OK', tipo:'primary'}]);
    }

    function cfgToXML(cfg){
        const esc = escapeHTML;
        const attrs = Object.keys(cfg).map(function(k){ return '    <campo nome="' + esc(k) + '">' + esc(cfg[k]) + '</campo>'; }).join('\n');
        const manualXML = manuais.map(function(m){ return '    <elemento tipo="' + esc(m.tipo) + '" x="' + Number(m.x).toFixed(3) + '" z="' + Number(m.z).toFixed(3) + '" scale="' + Number(m.scale || 1).toFixed(3) + '" />'; }).join('\n');
        return '<?xml version="1.0" encoding="UTF-8"?>\n<simulacaoRFCarvalho versao="16">\n  <configuracao>\n' + attrs + '\n  </configuracao>\n  <elementosManuais>\n' + manualXML + '\n  </elementosManuais>\n</simulacaoRFCarvalho>';
    }

    function guardarProjeto(){
        const cfg = lerCfg();
        localStorage.setItem('rfProjetoXML', cfgToXML(cfg));
        mostrarModal('Projeto guardado', 'A simulação foi guardada neste navegador em XML.', [{texto:'OK', tipo:'primary'}]);
    }

    function exportarXML(){
        const cfg = lerCfg();
        const blob = new Blob([cfgToXML(cfg)], {type:'application/xml;charset=utf-8'});
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = 'simulacao-rf-carvalho.xml';
        document.body.appendChild(a); a.click(); a.remove();
        URL.revokeObjectURL(a.href);
    }

    function importarXML(){
        const file = $('file-import');
        if(!file){ return; }
        file.onchange = function(){
            const f = file.files && file.files[0];
            if(!f){ return; }
            const reader = new FileReader();
            reader.onload = function(){ aplicarXML(String(reader.result || '')); };
            reader.readAsText(f);
            file.value = '';
        };
        file.click();
    }

    function idCampoConfig(k){
        const mapa = {
            areaTerreno:'area-terreno', formatoTerreno:'formato-terreno', posicaoCasa:'posicao-casa', entradaLote:'entrada-lote',
            tipoMuro:'tipo-muro', tracadoMuro:'tracado-muro', areaMuro:'area-muro', tipoPlanta:'tipo-planta', densidadeArvores:'densidade-arvores',
            estiloCasa:'estilo-casa', formatoCasa:'formato-casa', formatoLarguraL:'formato-l-largura', formatoProfundidadeL:'formato-l-profundidade', formatoLarguraU:'formato-u-largura', formatoProfundidadeU:'formato-u-profundidade', formatoAberturaU:'formato-u-abertura', personalizarPisos:'personalizar-pisos', paredeFrente:'parede-frente', paredeTras:'parede-tras', paredeEsq:'parede-esq', paredeDir:'parede-dir',
            piso1Largura:'piso1-largura', piso1Profundidade:'piso1-profundidade', piso2Largura:'piso2-largura', piso2Profundidade:'piso2-profundidade', piso3Largura:'piso3-largura', piso3Profundidade:'piso3-profundidade',
            vivendasQtd:'vivendas-qtd', vivendasDisposicao:'vivendas-disposicao', garagemPortoes:'garagem-portoes',
            garagemPortaLateral:'garagem-porta-lateral', garagemTelhado:'garagem-telhado', orientacaoTelhado:'orientacao-telhado', inclinacaoTelhado:'inclinacao-telhado',
            claraboias:'claraboia', paineis:'paineis-solares', posicaoAnexo:'posicao-anexo', portasAnexo:'portas-anexo', anexoLargura:'anexo-largura', anexoProfundidade:'anexo-profundidade',
            garagemAnexoPortoes:'garagem-anexo-portoes', anexoTelhado:'anexo-telhado', anexoManual:'anexo-manual', anexoX:'anexo-x', anexoZ:'anexo-z',
            posicaoPiscina:'posicao-piscina', piscinaComprimento:'piscina-comprimento', piscinaLargura:'piscina-largura', piscinaManual:'piscina-manual',
            piscinaX:'piscina-x', piscinaZ:'piscina-z', climatizacao:'climatizacao', varandaLargura:'varanda-largura', varandaProfundidade:'varanda-profundidade',
            anexoExtraLargura:'anexo-extra-largura', anexoExtraProfundidade:'anexo-extra-profundidade', anexoExtraAltura:'anexo-extra-altura', anexoExtraTelhado:'anexo-extra-telhado',
            pavimentoLargura:'pavimento-largura', pavimentoProfundidade:'pavimento-profundidade', caminhoLargura:'caminho-largura', caminhoComprimento:'caminho-comprimento',
            pergolaLargura:'pergola-largura', pergolaProfundidade:'pergola-profundidade', pergolaAltura:'pergola-altura', deckLargura:'deck-largura', deckProfundidade:'deck-profundidade', churrascoLargura:'churrasco-largura', churrascoProfundidade:'churrasco-profundidade'
        };
        return mapa[k] || k;
    }

    function aplicarXML(text){
        try{
            let data = {};
            let elems = [];
            if(text.trim().charAt(0) === '{'){
                const old = JSON.parse(text);
                data = old.config || old;
                elems = old.manuais || [];
            }else{
                const doc = new DOMParser().parseFromString(text, 'application/xml');
                doc.querySelectorAll('configuracao campo').forEach(function(c){ data[c.getAttribute('nome')] = c.textContent; });
                doc.querySelectorAll('elementosManuais elemento').forEach(function(e){
                    const item = {tipo:e.getAttribute('tipo'), x:parseFloat(e.getAttribute('x')), z:parseFloat(e.getAttribute('z')), scale:parseFloat(e.getAttribute('scale') || '1')};
                    ['w','d','h','y','rotY'].forEach(function(k){ if(e.hasAttribute(k)){ item[k] = parseFloat(e.getAttribute(k)); } });
                    if(e.hasAttribute('attached')){ item.attached = e.getAttribute('attached') === 'true' || e.getAttribute('attached') === '1'; }
                    if(e.hasAttribute('face')){ item.face = e.getAttribute('face'); }
                    if(e.hasAttribute('telhado')){ item.telhado = e.getAttribute('telhado'); }
                    elems.push(item);
                });
            }
            Object.keys(data).forEach(function(k){
                const el = $(idCampoConfig(k));
                if(!el){ return; }
                if(el.type === 'checkbox'){ el.checked = data[k] === true || data[k] === 'true' || data[k] === '1'; }
                else{ el.value = data[k]; }
            });
            manuais = elems.filter(function(e){ return e && e.tipo && isFinite(e.x) && isFinite(e.z); });
            atualizarGeometria(false);
            mostrarModal('XML importado', 'A simulação foi carregada com sucesso.', [{texto:'OK', tipo:'primary'}]);
        }catch(e){
            mostrarModal('Erro ao importar', 'Não foi possível ler o ficheiro XML/JSON selecionado.', [{texto:'OK', tipo:'primary'}]);
        }
    }

    function exportarImagem(){
        if(!renderizador){ return; }
        renderizador.render(cena, camara);
        const a = document.createElement('a');
        a.href = renderizador.domElement.toDataURL('image/png');
        a.download = 'simulacao-rf-carvalho.png';
        document.body.appendChild(a); a.click(); a.remove();
    }

    function atualizarGeometria(markBoot){
        aplicarVisibilidadeCondicional();
        const cfg = lerCfg();
        ultimoCfg = cfg;
        criarTerreno(cfg);
        const lote = criarLote(cfg);
        criarConstrucao(cfg, lote);
        posicionarCamara(lote);
        const msg = 'Geometria atualizada: ' + cfg.tipo + ' / ' + fmtM2(areaTotalConstrucao(cfg)) + ' / ' + cfg.andares + ' pisos.';
        log(msg, 'sys');
        if(markBoot !== false){ bootConcluido = true; }
    }

    function posicionarCamara(lote){
        if(!camara || !controlos){ return; }
        const maxDim = Math.max(lote.w, lote.d);
        controlos.target.set(0, 0, 0);
        if(!bootConcluido){
            camara.position.set(maxDim*.85, maxDim*.58, maxDim*.9);
            controlos.update();
        }
    }

    function onResize(){
        const holder = $('canvas-container');
        if(!holder || !camara || !renderizador){ return; }
        camara.aspect = Math.max(1, holder.clientWidth) / Math.max(1, holder.clientHeight);
        camara.updateProjectionMatrix();
        renderizador.setSize(holder.clientWidth, holder.clientHeight);
    }

    function loop(){
        requestAnimationFrame(loop);
        if(controlos){ controlos.update(); }
        if(renderizador && cena && camara){ renderizador.render(cena, camara); }
        frames++;
        const now = performance.now();
        if(now - ultimoFPS > 1000){
            const fps = $('fps-counter');
            if(fps){ fps.innerText = 'FPS: ' + frames; }
            frames = 0; ultimoFPS = now;
        }
    }

    function initFerramentas(){
        qsa('[data-tool]').forEach(function(btn){
            btn.addEventListener('click', function(){
                setFerramentaAtual(btn.getAttribute('data-tool'));
            });
        });
        qsa('[data-tool-category]').forEach(function(btn){
            btn.addEventListener('click', function(){
                setCategoriaFerramenta(btn.getAttribute('data-tool-category'));
            });
        });
    }

    function initAutoUpdate(){
        qsa('.js-auto-update').forEach(function(el){
            el.addEventListener('input', debounce(function(){ atualizarGeometria(false); }, 180));
            el.addEventListener('change', function(){ atualizarGeometria(false); });
        });
        aplicarVisibilidadeCondicional();
    }

    function debounce(fn, ms){
        let t = null;
        return function(){ clearTimeout(t); t = setTimeout(fn, ms); };
    }

    function alternarPainel(){
        const p = $('control-panel');
        if(p){ p.classList.toggle('aberto'); }
    }

    function alternarFerramentas3D(){
        const box = $('canvas-tools');
        if(!box){ return; }
        box.classList.toggle('aberto');
        if(box.classList.contains('aberto') && !categoriaFerramentaAtual){ setCategoriaFerramenta('chao'); }
    }

    function alternarDimensoesExteriores(){
        const el = $('modo-exteriores-avancado');
        if(el){
            el.value = el.value === '1' ? '0' : '1';
            aplicarVisibilidadeCondicional();
        }
        const painel = document.querySelector('[data-show-when="modo-exteriores-avancado:1"]');
        if(painel && el && el.value === '1'){ painel.scrollIntoView({behavior:'smooth', block:'nearest'}); }
    }

    function mostrarControlos(){
        mostrarModal(
            'Controlos 3D',
            'Câmara:\n' +
            '• Scroll: zoom\n' +
            '• Botão esquerdo: rodar câmara\n' +
            '• Botão direito: deslocar câmara\n\n' +
            'Colocação de objetos:\n' +
            '• R: rodar o objeto selecionado\n' +
            '• Shift + R: rodar no sentido contrário\n' +
            '• Alt + R: rotação fina\n' +
            '• W/A/S/D ou setas: ajustar a posição antes de colocar\n' +
            '• Shift: subir ligeiramente o objeto\n' +
            '• Ctrl: descer ligeiramente o objeto\n' +
            '• Verde: pode colocar\n' +
            '• Vermelho: existe colisão ou está fora do lote\n' +
            '• Escape: cancelar ferramenta ativa\n\n' +
            'Pavimento:\n' +
            '• Quando aproxima uma peça de pavimento a outra, ela tenta colar automaticamente à peça existente.',
            [{texto:'OK', tipo:'primary'}]
        );
    }

    function arrancar(){
        initTema();
        if(!initThree()){ return; }
        criarMateriais();
        initAutoUpdate();
        initFerramentas();
        const saved = localStorage.getItem('rfProjetoXML');
        if(saved && document.body.getAttribute('data-mode') === 'pro'){
            // Não carrega automaticamente para não confundir o utilizador; fica disponível por importação/guardar.
        }
        atualizarGeometria(true);
        const loader = $('loading-screen');
        if(loader){ setTimeout(function(){ loader.style.opacity = '0'; setTimeout(function(){ loader.style.display='none'; }, 260); }, 420); }
        log('Engine CAD 20.0 pronto. Qualidade: ' + QUALITY + '.', 'sys');
        loop();
    }

    document.addEventListener('DOMContentLoaded', arrancar);

    return {
        atualizarGeometria: atualizarGeometria,
        calcularOrcamento: calcularOrcamento,
        mostrarAjuda: mostrarAjuda,
        mostrarTermos: mostrarTermos,
        mostrarControlos: mostrarControlos,
        guardarProjeto: guardarProjeto,
        exportarXML: exportarXML,
        importarXML: importarXML,
        exportarImagem: exportarImagem,
        limparManuais: limparManuais,
        apagarExtraPorIndice: apagarExtraPorIndice,
        alternarPainel: alternarPainel,
        alternarFerramentas3D: alternarFerramentas3D,
        alternarDimensoesExteriores: alternarDimensoesExteriores
    };
})();
