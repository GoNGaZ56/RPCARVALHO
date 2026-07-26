/**
 * ==============================================================================
 * ENGINE CAD R.F. CARVALHO - SIMULAÇÃO ARQUITETÓNICA DE ALTA COMPLEXIDADE
 * ==============================================================================
 * Build: 6.0.0 (Ultimate CSG Edition)
 * Lógica: Implementação de cortes topográficos para rampas curvas/retas.
 * Resolução do Bug de Assimetria e Renderização Tardia de Elementos.
 * Formatação Rigorosa: Chavetas coladas if{ for{ function(){
 * ==============================================================================
 */

const App = (function(){
    // ==========================================================================
    // 1. GESTÃO DE ESTADO E MEMÓRIA GRÁFICA
    // ==========================================================================
    let cena, camara, renderizador, controlos;
    let grupoConstrucao = new THREE.Group();
    let grupoAmbiente = new THREE.Group();
    let malhaTerreno = null;
    let elementosAdicionados = []; 
    let materiaisCacheados = {};
    let isModoEscuro = true;

    const raycasterFuros = new THREE.Raycaster();
    const raycasterTerreno = new THREE.Raycaster();
    const rato = new THREE.Vector2();
    let ferramentaAtual = null;
    let luzSolar, luzHemi;

    let frames = 0;
    let ultimoTempoFPS = performance.now();

    // ==========================================================================
    // 2. CONSOLA DO DESENVOLVEDOR (LOGS EM TEMPO REAL)
    // ==========================================================================
    function logNoTerminal(msg, tipo = 'sys'){
        const cons = document.getElementById('console-logs');
        if(!cons){ return; }
        const data = new Date();
        const tempo = data.getHours().toString().padStart(2, '0') + ":" + data.getMinutes().toString().padStart(2, '0') + ":" + data.getSeconds().toString().padStart(2, '0');
        
        const div = document.createElement('div');
        div.className = 'console-line';
        
        let colorClass = 'console-sys';
        if(tipo === 'warn'){ colorClass = 'console-warn'; }
        if(tipo === 'err'){ colorClass = 'console-err'; }

        div.innerHTML = `<span class="console-time">[${tempo}]</span> <span class="${colorClass}">> ${msg}</span>`;
        cons.appendChild(div);
        
        const container = document.getElementById('dev-console');
        if(container){ container.scrollTop = container.scrollHeight; }
    }

    function verificarHardware(){
        logNoTerminal("A iniciar verificação de instruções WebGL...", "sys");
        const canvas = document.createElement('canvas');
        const gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
        
        if(!gl){
            logNoTerminal("FATAL: GPU não suporta processamento gráfico WebGL.", "err");
            const loadHard = document.getElementById('loading-hardware');
            if(loadHard){ loadHard.innerText = "ERRO: O seu sistema não cumpre os requisitos mínimos."; }
            return false;
        }

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        let gpu = "Arquitetura Desconhecida";
        if(debugInfo){ gpu = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL); }

        logNoTerminal(`Placa Gráfica: ${gpu}`, "sys");
        logNoTerminal("Autorização concedida. Motor pronto para arranque.", "sys");
        return true;
    }

    // ==========================================================================
    // 3. ARRANQUE E CONFIGURAÇÃO DA VIEWPORT
    // ==========================================================================
    function arrancar(){
        if(!verificarHardware()){ return; }

        const contentor = document.getElementById('canvas-container');
        if(!contentor){
            console.error("Contentor CAD não encontrado no DOM.");
            return; 
        }

        cena = new THREE.Scene();
        cena.background = new THREE.Color(0x0a0a0a); 
        cena.fog = new THREE.FogExp2(0x0a0a0a, 0.0012); 
        
        cena.add(grupoConstrucao);
        cena.add(grupoAmbiente);

        camara = new THREE.PerspectiveCamera(45, contentor.clientWidth / contentor.clientHeight, 0.1, 5000);
        camara.position.set(120, 90, 160);

        renderizador = new THREE.WebGLRenderer({ antialias: true, powerPreference: "high-performance", alpha: false });
        renderizador.setPixelRatio(window.devicePixelRatio);
        renderizador.setSize(contentor.clientWidth, contentor.clientHeight);
        renderizador.shadowMap.enabled = true;
        renderizador.shadowMap.type = THREE.PCFSoftShadowMap;
        renderizador.toneMapping = THREE.ACESFilmicToneMapping; 
        renderizador.toneMappingExposure = 1.1;
        
        contentor.appendChild(renderizador.domElement);

        luzHemi = new THREE.HemisphereLight(0xffffff, 0x444444, 0.4);
        luzHemi.position.set(0, 300, 0);
        cena.add(luzHemi);

        luzSolar = new THREE.DirectionalLight(0xffffff, 1.4);
        luzSolar.position.set(200, 300, 150);
        luzSolar.castShadow = true;
        luzSolar.shadow.mapSize.width = 4096;
        luzSolar.shadow.mapSize.height = 4096;
        luzSolar.shadow.camera.near = 10;
        luzSolar.shadow.camera.far = 1500;
        luzSolar.shadow.camera.left = -400;
        luzSolar.shadow.camera.right = 400;
        luzSolar.shadow.camera.top = 400;
        luzSolar.shadow.camera.bottom = -400;
        luzSolar.shadow.bias = -0.0005;
        cena.add(luzSolar);

        controlos = new THREE.OrbitControls(camara, renderizador.domElement);
        controlos.enableDamping = true;
        controlos.dampingFactor = 0.05;
        controlos.maxPolarAngle = Math.PI / 2 + 0.01; 
        controlos.minDistance = 20;
        controlos.maxDistance = 1000;
        
        contentor.addEventListener('click', aoClicarRato, false);
        window.addEventListener('resize', aoRedimensionar, false);

        gerarMateriaisPBR();
        atualizarConstrucao();
        
        const loader = document.getElementById('loading-screen');
        if(loader){
            setTimeout(function(){
                loader.style.opacity = '0';
                setTimeout(function(){ 
                    loader.style.display = 'none'; 
                    logNoTerminal("Boot concluído. A renderizar a 60FPS.", "sys");
                }, 400);
            }, 800);
        }

        loopMotor();
    }

    // ==========================================================================
    // 4. SHADERS E TEXTURAS PBR (GERAÇÃO LOCAL DE ALTA FIDELIDADE)
    // ==========================================================================
    function gerarMateriaisPBR(){
        logNoTerminal("A compilar bibliotecas de materiais PBR...", "sys");
        
        materiaisCacheados['moderno'] = new THREE.MeshPhysicalMaterial({ 
            color: 0xe5e5e5, roughness: 0.8, metalness: 0.1, clearcoat: 0.05
        });

        const cvMad = document.createElement('canvas'); cvMad.width = 512; cvMad.height = 512;
        const ctxMad = cvMad.getContext('2d');
        ctxMad.fillStyle = '#4a2f1d'; ctxMad.fillRect(0, 0, 512, 512);
        for(let x=0; x<512; x+=8){
            ctxMad.fillStyle = Math.random() > 0.5 ? '#3e2312' : '#5c3a21';
            ctxMad.fillRect(x, 0, Math.random()*4+2, 512);
        }
        materiaisCacheados['madeira'] = new THREE.MeshPhysicalMaterial({
            map: new THREE.CanvasTexture(cvMad), roughness: 0.9, metalness: 0.0
        });

        materiaisCacheados['asfalto'] = new THREE.MeshPhysicalMaterial({
            color: 0x1f1f1f, roughness: 0.95, metalness: 0.1
        });

        materiaisCacheados['agua'] = new THREE.MeshPhysicalMaterial({
            color: 0x0ea5e9, transmission: 0.9, opacity: 1, metalness: 0, roughness: 0.05, ior: 1.33, thickness: 2.0
        });

        const cvPorta = document.createElement('canvas'); cvPorta.width = 512; cvPorta.height = 1024;
        const ctxPorta = cvPorta.getContext('2d');
        ctxPorta.fillStyle = '#171717'; ctxPorta.fillRect(0, 0, 512, 1024); 
        ctxPorta.fillStyle = '#262626'; 
        ctxPorta.fillRect(60, 60, 392, 400); ctxPorta.fillRect(60, 520, 392, 440);
        ctxPorta.fillStyle = '#a3a3a3'; ctxPorta.fillRect(420, 500, 30, 120);
        materiaisCacheados['portaReal'] = new THREE.MeshPhysicalMaterial({ 
            map: new THREE.CanvasTexture(cvPorta), metalness: 0.3, roughness: 0.5 
        });

        const cvJan = document.createElement('canvas'); cvJan.width = 1024; cvJan.height = 1024;
        const ctxJan = cvJan.getContext('2d');
        ctxJan.fillStyle = '#000000'; ctxJan.fillRect(0, 0, 1024, 1024); 
        ctxJan.fillStyle = '#38bdf8'; ctxJan.fillRect(40, 40, 944, 944); 
        ctxJan.fillStyle = '#000000'; ctxJan.fillRect(492, 40, 40, 944); 
        ctxJan.fillStyle = 'rgba(255,255,255,0.2)'; 
        ctxJan.beginPath(); ctxJan.moveTo(100, 1024); ctxJan.lineTo(600, 0); ctxJan.lineTo(700, 0); ctxJan.lineTo(200, 1024); ctxJan.fill();
        materiaisCacheados['janelaReal'] = new THREE.MeshPhysicalMaterial({ 
            map: new THREE.CanvasTexture(cvJan), metalness: 0.7, roughness: 0.1 
        });
        
        // Vidro e Vegetação para o Muro
        materiaisCacheados['vidro'] = new THREE.MeshPhysicalMaterial({ color: 0xe2e8f0, transmission: 0.9, opacity: 1, roughness: 0.1 });
        materiaisCacheados['betao'] = new THREE.MeshPhysicalMaterial({ color: 0x52525b, roughness: 0.9 });
        materiaisCacheados['sebe'] = new THREE.MeshPhysicalMaterial({ color: 0x14532d, roughness: 1.0 });
    }

    function lerValorID(id, defaultVal, isCheckbox){
        const el = document.getElementById(id);
        if(!el){ return defaultVal; }
        if(isCheckbox){ return el.checked; }
        return el.value;
    }

    // ==========================================================================
    // 5. NÚCLEO TOPOGRÁFICO - CÁLCULOS MATEMÁTICOS DE CORTE E DECLIVE
    // Aqui garantimos que a rampa rasga a terra consoante a posição e curva
    // ==========================================================================
    function calcularDeformacaoBase(px, pz, tipoTerreno, ladoCasa, compMuro){
        if(tipoTerreno === 'normal' || tipoTerreno === 'escavacao'){ return 0; }
        let dist = Math.sqrt(px*px + pz*pz);
        let limMuro = ladoCasa * 2.2;
        
        if(compMuro === 'plano' && Math.abs(px) <= limMuro && Math.abs(pz) <= limMuro){
            return 0; // Aplaina a zona inteira da casa
        }
        
        if(tipoTerreno === 'encosta' || tipoTerreno === 'montanha'){
            let inc = tipoTerreno === 'montanha' ? 0.35 : 0.15;
            if(dist > ladoCasa * 1.5 || compMuro === 'plano'){
                return (pz * inc) + (Math.sin(px * 0.04) * 4); // Ruído natural
            }
        }
        return 0;
    }

    function rasgarTerrenoGaragem(px, pz, altAtual, ladoCasa, optGaragem, acessoGaragem){
        if(optGaragem !== 'subterranea'){ return altAtual; }
        
        const larg = 7.5; const compR = 18; const prof = 4.0;
        const offsetCasa = ladoCasa / 2;

        if(acessoGaragem === 'frente_reta'){
            if(pz > offsetCasa && pz < (offsetCasa + compR) && Math.abs(px) < larg/2){
                let p = (pz - offsetCasa) / compR;
                return -(prof * (1 - p));
            }
        }else if(acessoGaragem === 'frente_curva'){
            // Rampa curva (Corta a direito e depois vira à direita)
            if(pz > offsetCasa && pz < (offsetCasa + compR/2) && Math.abs(px) < larg/2){
                let p = (pz - offsetCasa) / compR; return -(prof * (1 - p));
            }
            if(pz > (offsetCasa + compR/2 - larg/2) && pz < (offsetCasa + compR/2 + larg/2) && px > 0 && px < compR/2){
                let p = 0.5 + (px / compR); return -(prof * (1 - p));
            }
        }else if(acessoGaragem === 'tras_reta'){
            if(pz < -offsetCasa && pz > -(offsetCasa + compR) && Math.abs(px) < larg/2){
                let p = (Math.abs(pz) - offsetCasa) / compR;
                return -(prof * (1 - p));
            }
        }else if(acessoGaragem === 'esq_reta'){
            if(px < -offsetCasa && px > -(offsetCasa + compR) && Math.abs(pz) < larg/2){
                let p = (Math.abs(px) - offsetCasa) / compR;
                return -(prof * (1 - p));
            }
        }
        
        // Cova central para o corpo da cave
        if(Math.abs(px) < larg/2 + 1 && Math.abs(pz) < offsetCasa + 1){
            return -prof;
        }

        return altAtual;
    }

    // ==========================================================================
    // 6. RAYCASTER ABSOLUTO (ANTI-FLYING OBJECTS)
    // ==========================================================================
    function colarElementoTerreno(posX, posZ){
        if(!malhaTerreno){ return 0; }
        let org = new THREE.Vector3(posX, 1000, posZ);
        let dir = new THREE.Vector3(0, -1, 0);
        raycasterTerreno.set(org, dir);
        let inters = raycasterTerreno.intersectObject(malhaTerreno, false);
        if(inters.length > 0){
            return inters[0].point.y; 
        }
        return calcularDeformacaoBase(posX, posZ, lerValorID('terreno', 'normal', false), Math.sqrt(parseFloat(lerValorID('area','150',false))), lerValorID('comportamento-muro', 'acompanha', false));
    }

    // ==========================================================================
    // 7. GERAÇÃO DO AMBIENTE (MALHA, ESTRADAS, FLORESTA)
    // ==========================================================================
    function gerarTerrenoPrincipal(ladoCasa, tipoTerreno, optGaragem, optEstrada, compMuro, acessoGaragem){
        logNoTerminal("A injetar malha topográfica (High-Poly)...", "sys");
        while(grupoAmbiente.children.length > 0){
            let obj = grupoAmbiente.children[0];
            if(obj.geometry){ obj.geometry.dispose(); }
            grupoAmbiente.remove(obj);
        }

        const matRelva = new THREE.MeshPhysicalMaterial({ color: 0x166534, roughness: 1.0, metalness: 0.0 });
        const geoTerreno = new THREE.PlaneGeometry(1600, 1600, 256, 256);
        const posT = geoTerreno.attributes.position;
        
        for(let i=0; i<posT.count; i++){
            let px = posT.getX(i);
            let pz = posT.getY(i); 
            let altBase = calcularDeformacaoBase(px, pz, tipoTerreno, ladoCasa, compMuro);
            let altFinal = rasgarTerrenoGaragem(px, pz, altBase, ladoCasa, optGaragem, acessoGaragem);
            posT.setZ(i, altFinal);
        }
        
        geoTerreno.computeVertexNormals();
        malhaTerreno = new THREE.Mesh(geoTerreno, matRelva);
        malhaTerreno.rotation.x = -Math.PI / 2;
        malhaTerreno.receiveShadow = true;
        grupoAmbiente.add(malhaTerreno);
        
        // FORÇA A ATUALIZAÇÃO DA MATRIZ PARA O RAYCASTER NÃO FALHAR OS ANEXOS
        malhaTerreno.updateMatrixWorld(true);

        // Gera a via rodoviária e cola-a ao chão
        if(optEstrada !== 'nenhuma'){
            logNoTerminal(`A desenhar acesso rodoviário: ${optEstrada.toUpperCase()}`, "sys");
            let matAsf = materiaisCacheados['asfalto'];
            let oE = ladoCasa * 4.0;
            let estGeo = null;

            if(optEstrada === 'frente'){ estGeo = new THREE.PlaneGeometry(1600, 25, 256, 4); estGeo.translate(0, oE, 0); }
            if(optEstrada === 'tras'){ estGeo = new THREE.PlaneGeometry(1600, 25, 256, 4); estGeo.translate(0, -oE, 0); }
            if(optEstrada === 'esquerda'){ estGeo = new THREE.PlaneGeometry(25, 1600, 4, 256); estGeo.translate(-oE, 0, 0); }
            if(optEstrada === 'direita'){ estGeo = new THREE.PlaneGeometry(25, 1600, 4, 256); estGeo.translate(oE, 0, 0); }

            if(estGeo){
                estGeo.rotateX(-Math.PI / 2);
                let vts = estGeo.attributes.position;
                for(let k = 0; k < vts.count; k++){
                    let wX = vts.getX(k); let wZ = vts.getZ(k);
                    let altR = colarElementoTerreno(wX, wZ);
                    vts.setY(k, altR + 0.15); 
                }
                estGeo.computeVertexNormals();
                let estMesh = new THREE.Mesh(estGeo, matAsf);
                estMesh.receiveShadow = true;
                grupoAmbiente.add(estMesh);
            }
        }
    }

    function popularVegetacao(ladoCasa, tipoPlanta, optEstrada){
        if(tipoPlanta === 'nenhuma'){ return; }
        logNoTerminal("A popular bioma vegetal via InstancedMesh...", "sys");
        
        const maxArv = 400; 
        const geoCopa = new THREE.DodecahedronGeometry(5, 1);
        const matCopa = new THREE.MeshPhysicalMaterial({ color: 0x14532d, roughness: 0.9 });
        const geoTronco = new THREE.CylinderGeometry(0.8, 1.2, 6);
        const matTronco = new THREE.MeshPhysicalMaterial({ color: 0x3e2723, roughness: 1.0 });

        const malhaC = new THREE.InstancedMesh(geoCopa, matCopa, maxArv);
        malhaC.castShadow = true; malhaC.receiveShadow = true;
        const malhaT = new THREE.InstancedMesh(geoTronco, matTronco, maxArv);
        malhaT.castShadow = true; malhaT.receiveShadow = true;

        let dummy = new THREE.Object3D();
        let cont = 0;

        for(let i=0; i<maxArv; i++){
            let px = (Math.random() - 0.5) * 1400;
            let pz = (Math.random() - 0.5) * 1400;
            let limCasa = (ladoCasa * 2.8);
            
            if(Math.abs(px) > limCasa || Math.abs(pz) > limCasa){
                let naEstrada = false;
                if(optEstrada === 'frente' && Math.abs(pz - (ladoCasa*4.0)) < 25){ naEstrada = true; }
                if(optEstrada === 'tras' && Math.abs(pz - (-ladoCasa*4.0)) < 25){ naEstrada = true; }
                if(optEstrada === 'esquerda' && Math.abs(px - (-ladoCasa*4.0)) < 25){ naEstrada = true; }
                if(optEstrada === 'direita' && Math.abs(px - (ladoCasa*4.0)) < 25){ naEstrada = true; }

                if(!naEstrada){
                    let altY = colarElementoTerreno(px, pz);
                    let esc = 0.6 + (Math.random() * 0.7);

                    dummy.position.set(px, altY + (3 * esc), pz);
                    dummy.scale.set(esc, esc, esc);
                    dummy.updateMatrix();
                    malhaT.setMatrixAt(cont, dummy.matrix);

                    dummy.position.set(px, altY + (7 * esc), pz);
                    dummy.updateMatrix();
                    malhaC.setMatrixAt(cont, dummy.matrix);
                    cont++;
                }
            }
        }
        malhaC.count = cont; malhaT.count = cont;
        grupoAmbiente.add(malhaC); grupoAmbiente.add(malhaT);
    }

    function construirVedacao(ladoCasa, tipoMuro){
        if(tipoMuro === 'nenhum'){ return; }
        logNoTerminal("A edificar perímetro de segurança...", "sys");
        const lim = ladoCasa * 2.2;
        
        let matMuro = materiaisCacheados['betao'];
        if(tipoMuro === 'vegetacao'){ matMuro = materiaisCacheados['sebe']; }
        if(tipoMuro === 'vidro'){ matMuro = materiaisCacheados['vidro']; }
        
        let posMuro = [
            {xi: -lim, zi: -lim, xf: lim, zf: -lim},
            {xi: -lim, zi: lim, xf: lim, zf: lim}, 
            {xi: -lim, zi: -lim, xf: -lim, zf: lim},
            {xi: lim, zi: -lim, xf: lim, zf: lim}  
        ];

        const perimetro = (lim*2)*4 + 20;
        const gH = new THREE.BoxGeometry(1.05, 12, 0.6);
        const gV = new THREE.BoxGeometry(0.6, 12, 1.05);
        
        const iH = new THREE.InstancedMesh(gH, matMuro, perimetro); iH.castShadow = true; iH.receiveShadow = true;
        const iV = new THREE.InstancedMesh(gV, matMuro, perimetro); iV.castShadow = true; iV.receiveShadow = true;

        let dummy = new THREE.Object3D();
        let cH = 0; let cV = 0;

        for(let p = 0; p < posMuro.length; p++){
            let cur = posMuro[p];
            let isHoriz = (cur.zi === cur.zf);
            let distTotal = isHoriz ? (cur.xf - cur.xi) : (cur.zf - cur.zi);
            
            for(let s = 0; s < distTotal; s += 1){
                let px = isHoriz ? (cur.xi + s) : cur.xi;
                let pz = isHoriz ? cur.zi : (cur.zi + s);
                let yBase = colarElementoTerreno(px, pz);
                
                dummy.position.set(px, yBase - 4, pz);
                dummy.scale.set(1,1,1);
                dummy.updateMatrix();

                if(isHoriz){ iH.setMatrixAt(cH, dummy.matrix); cH++; }
                else{ iV.setMatrixAt(cV, dummy.matrix); cV++; }
            }
        }
        iH.count = cH; iV.count = cV;
        grupoAmbiente.add(iH); grupoAmbiente.add(iV);
    }

    // ==========================================================================
    // 8. NÚCLEO DE CONSTRUÇÃO ARQUITETÓNICA (CASA, ASSIMETRIA E ANEXOS)
    // ==========================================================================
    function atualizarConstrucao(){
        logNoTerminal("A invocar pipeline de construção (LOD0)...", "sys");
        while(grupoConstrucao.children.length > 0){
            let obj = grupoConstrucao.children[0];
            if(obj.geometry){ obj.geometry.dispose(); }
            grupoConstrucao.remove(obj);
        }
        elementosAdicionados = [];

        const vTipo = lerValorID('tipo', 'moradia', false);
        const vArea = parseFloat(lerValorID('area', '150', false)) || 150;
        const vAndares = parseInt(lerValorID('andares', '3', false)) || 3;
        const optGaragem = lerValorID('garagem', 'nenhuma', false);
        const acessoGaragem = lerValorID('garagem-acesso', 'frente_reta', false);
        const optEstrada = lerValorID('estrada', 'nenhuma', false);
        const optTerreno = lerValorID('terreno', 'normal', false);
        const optPlantas = lerValorID('tipo-planta', 'arvores', false);
        const optMuro = lerValorID('tipo-muro', 'nenhum', false);
        const compMuro = lerValorID('comportamento-muro', 'acompanha', false);
        
        const optAssimetria = lerValorID('assimetria', false, true);
        const optTelhado = lerValorID('telhado', 'plano', false);
        const numClara = parseInt(lerValorID('claraboia', '0', false));
        const optAnexos = lerValorID('anexos', 'nenhum', false);
        const optPergola = lerValorID('pergola', 'nenhuma', false);
        const optPiscina = lerValorID('piscina', false, true);
        const optSolares = lerValorID('paineis-solares', false, true);
        
        const lado = Math.sqrt(vArea);
        const peDireito = 3.2; 
        const matParede = materiaisCacheados['moderno'];

        // 1. Gera o mapa mundi e os ambientes
        gerarTerrenoPrincipal(lado, optTerreno, optGaragem, optEstrada, compMuro, acessoGaragem);
        popularVegetacao(lado, optPlantas, optEstrada);
        construirVedacao(lado, optMuro);

        // A fundação central que define a altura base da casa
        let yCentral = colarElementoTerreno(0, 0);
        let elevacaoBase = yCentral;

        // 2. Fundações Visuais (Buracos ou Pilares Gigantes)
        if(optTerreno === 'encosta' || optTerreno === 'montanha'){
            const pilar = new THREE.Mesh(new THREE.BoxGeometry(lado, 40, lado), new THREE.MeshPhysicalMaterial({ color: 0x171717 }));
            pilar.position.y = yCentral - 20;
            grupoConstrucao.add(pilar);
        }else if(optTerreno === 'escavacao'){
            elevacaoBase = yCentral - 1.5;
            const buraco = new THREE.Mesh(new THREE.BoxGeometry(lado + 2.5, 1.5, lado + 2.5), new THREE.MeshPhysicalMaterial({ color: 0x000000, side: THREE.BackSide }));
            buraco.position.y = yCentral - 0.75;
            grupoConstrucao.add(buraco);
        }

        // 3. Edificação dos Andares (Lógica de Assimetria Fixa)
        let altBaseTopo = 0;
        let larguraTopo = lado;
        let dXTopo = 0;
        let dZTopo = 0;

        for(let i=0; i<vAndares; i++){
            let propTam = 1.0;
            let dX = 0; let dZ = 0;
            
            // Assimetria: se o piso for > 0, o bloco fica mais pequeno e encostado atrás
            if(optAssimetria && i > 0){
                propTam = 0.65; 
                dX = (lado * 0.35) / 2; 
                dZ = -(lado * 0.35) / 2; 
            }

            const ladoAtual = lado * propTam;
            const piso = new THREE.Mesh(new THREE.BoxGeometry(ladoAtual, peDireito, ladoAtual), matParede);
            const altY = elevacaoBase + (peDireito / 2) + (i * peDireito);
            piso.position.set(dX, altY, dZ);
            piso.castShadow = true; piso.receiveShadow = true;
            piso.userData = { tipoObjeto: 'fachada' }; 
            grupoConstrucao.add(piso);
            
            // Varanda frontal resultante da assimetria
            if(optAssimetria && i > 0){
                const profVaranda = lado * 0.35;
                const matVaranda = new THREE.MeshPhysicalMaterial({ color: 0x52525b });
                const matGuarda = materiaisCacheados['vidro'];
                
                const pisoVar = new THREE.Mesh(new THREE.BoxGeometry(lado, 0.2, profVaranda), matVaranda);
                pisoVar.position.set(0, altY - (peDireito/2) + 0.1, (lado/2) - (profVaranda/2));
                pisoVar.receiveShadow = true;
                grupoConstrucao.add(pisoVar);

                const guardaFrente = new THREE.Mesh(new THREE.BoxGeometry(lado, 1.1, 0.05), matGuarda);
                guardaFrente.position.set(0, pisoVar.position.y + 0.55, (lado/2));
                grupoConstrucao.add(guardaFrente);
            }

            altBaseTopo = altY + (peDireito / 2);
            larguraTopo = ladoAtual;
            dXTopo = dX;
            dZTopo = dZ;
        }

        // 4. Telhado e Sustentabilidade
        if(optTelhado === 'plano'){
            const platibanda = new THREE.Mesh(new THREE.BoxGeometry(larguraTopo + 0.4, 0.8, larguraTopo + 0.4), new THREE.MeshPhysicalMaterial({ color: 0x262626 }));
            platibanda.position.set(dXTopo, altBaseTopo + 0.4, dZTopo); 
            platibanda.castShadow = true;
            grupoConstrucao.add(platibanda);
            
            if(numClara > 0){
                const matAro = new THREE.MeshPhysicalMaterial({ color: 0x111111 });
                const constrC = function(x, z){
                    const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 0.4, 1.6), matAro);
                    c.position.set(x, altBaseTopo + 0.8, z);
                    grupoConstrucao.add(c);
                };
                if(numClara === 1){ constrC(dXTopo, dZTopo); }
                if(numClara === 2){ constrC(dXTopo - 1.5, dZTopo); constrC(dXTopo + 1.5, dZTopo); }
            }
        }else if(optTelhado === 'inclinado'){
            const telMat = new THREE.MeshPhysicalMaterial({ color: 0x7f1d1d, roughness: 0.9 });
            const telhado = new THREE.Mesh(new THREE.ConeGeometry((larguraTopo * 1.5) / 2, 4.0, 4), telMat);
            telhado.position.set(dXTopo, altBaseTopo + 2.0, dZTopo); 
            telhado.rotation.y = Math.PI / 4; 
            telhado.castShadow = true;
            grupoConstrucao.add(telhado);
        }

        if(optSolares){
            for(let ps = -1; ps <= 1; ps += 2){
                const painel = new THREE.Mesh(new THREE.BoxGeometry(2.5, 0.1, 4.5), new THREE.MeshPhysicalMaterial({ color: 0x000, metalness: 0.8 }));
                let alturaP = optTelhado === 'inclinado' ? altBaseTopo + 2.2 : altBaseTopo + 0.9;
                let incl = optTelhado === 'inclinado' ? -Math.PI/5 : -Math.PI/8;
                painel.position.set(dXTopo + (ps * 2.5), alturaP, dZTopo + 2);
                painel.rotation.x = incl;
                grupoConstrucao.add(painel);
            }
        }

        // 5. Garagem Integrada com Túnel Físico
        if(optGaragem === 'subterranea'){
            const lG = 7; const profG = 16; const altG = 4.0;
            
            const cave = new THREE.Mesh(new THREE.BoxGeometry(lG, altG, lado), new THREE.MeshPhysicalMaterial({ color: 0x111, side: THREE.DoubleSide }));
            cave.position.set(0, yCentral - altG/2, 0);
            grupoConstrucao.add(cave);
            
            const portao = new THREE.Mesh(new THREE.PlaneGeometry(lG - 1.2, altG - 0.6), new THREE.MeshPhysicalMaterial({ color: 0x222, metalness: 0.8 }));
            
            // Colocação do portão com base no acesso escolhido
            if(acessoGaragem.includes('frente')){ portao.position.set(0, yCentral - altG/2, lado/2 + 0.05); }
            if(acessoGaragem.includes('tras')){ portao.position.set(0, yCentral - altG/2, -(lado/2 + 0.05)); portao.rotation.y = Math.PI; }
            if(acessoGaragem.includes('esq')){ portao.position.set(-(lado/2 + 0.05), yCentral - altG/2, 0); portao.rotation.y = -Math.PI/2; }
            grupoConstrucao.add(portao);
            
            // Construção Física da Rampa de Betão Visível
            const matRampaBetao = materiaisCacheados['asfalto'];
            if(acessoGaragem === 'frente_reta'){
                const rampaMalha = new THREE.Mesh(new THREE.PlaneGeometry(lG, profG), matRampaBetao);
                rampaMalha.rotation.x = -Math.PI / 2 - Math.atan2(altG, profG);
                rampaMalha.position.set(0, yCentral - altG/2, lado/2 + profG/2);
                grupoConstrucao.add(rampaMalha);
            }
        }else if(optGaragem !== 'nenhuma'){
            const lG = 6.5; const profG = 7.5; const altG = 3.8;
            let pXG = 0; let pZG = 0;
            if(optGaragem === 'colada_esq'){ pXG = -(lado/2) - (lG/2); pZG = (lado/2) - (profG/2); }
            if(optGaragem === 'colada_dir'){ pXG = (lado/2) + (lG/2); pZG = (lado/2) - (profG/2); }
            
            let altGara = colarElementoTerreno(pXG, pZG);
            const garagem = new THREE.Mesh(new THREE.BoxGeometry(lG, altG, profG), matParede);
            garagem.position.set(pXG, altGara + altG/2, pZG);
            garagem.castShadow = true; garagem.receiveShadow = true;
            grupoConstrucao.add(garagem);

            const portaoLat = new THREE.Mesh(new THREE.PlaneGeometry(lG - 1.2, altG - 0.6), new THREE.MeshPhysicalMaterial({ color: 0x222 }));
            portaoLat.position.set(pXG, altGara + (altG - 0.5)/2, garagem.position.z + (profG/2) + 0.02);
            grupoConstrucao.add(portaoLat);
        }

        // 6. Anexos Matemáticos (Aparecem Sempre)
        if(optAnexos !== 'nenhum'){
            const lA = optAnexos === 'lazer' ? 12 : 6;
            const profA = 5; const altA = 3.0;
            let pXA = -lado - 4; let pZA = -lado + 4;
            let altAnexo = colarElementoTerreno(pXA, pZA);
            
            const anexo = new THREE.Mesh(new THREE.BoxGeometry(lA, altA, profA), matParede);
            anexo.position.set(pXA, altAnexo + altA/2, pZA);
            anexo.castShadow = true; anexo.receiveShadow = true; anexo.userData = { tipoObjeto: 'fachada' };
            grupoConstrucao.add(anexo);
            
            const portaA = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 2.2), materiaisCacheados['portaReal']);
            portaA.position.set(pXA, altAnexo + 1.1, pZA + (profA/2) + 0.05);
            grupoConstrucao.add(portaA);
        }

        // 7. Pérgolas com Raycasting de Precisão
        if(optPergola !== 'nenhuma'){
            const lPer = lado * 0.7; const profPer = 5;
            let pXPer = 0; let pZPer = -(lado/2) - (profPer/2);
            if(optPergola === 'afastada'){ pXPer = lado + 2; pZPer = -lado - 3; }
            
            let altPerg = colarElementoTerreno(pXPer, pZPer);
            const matMad = materiaisCacheados['madeira'];
            const pilarG = new THREE.BoxGeometry(0.3, peDireito, 0.3);
            
            const p1 = new THREE.Mesh(pilarG, matMad); p1.position.set(pXPer - (lPer/2) + 0.5, altPerg + peDireito/2, pZPer - (profPer/2) + 0.5); p1.castShadow=true;
            const p2 = new THREE.Mesh(pilarG, matMad); p2.position.set(pXPer + (lPer/2) - 0.5, altPerg + peDireito/2, pZPer - (profPer/2) + 0.5); p2.castShadow=true;
            grupoConstrucao.add(p1); grupoConstrucao.add(p2);
            
            if(optPergola === 'afastada'){
                const p3 = new THREE.Mesh(pilarG, matMad); p3.position.set(pXPer - (lPer/2) + 0.5, altPerg + peDireito/2, pZPer + (profPer/2) - 0.5); p3.castShadow=true;
                const p4 = new THREE.Mesh(pilarG, matMad); p4.position.set(pXPer + (lPer/2) - 0.5, altPerg + peDireito/2, pZPer + (profPer/2) - 0.5); p4.castShadow=true;
                grupoConstrucao.add(p3); grupoConstrucao.add(p4);
            }
            
            for(let r = -lPer/2; r <= lPer/2; r += 0.8){
                const ripa = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, profPer + 0.5), matMad);
                ripa.position.set(pXPer + r, altPerg + peDireito + 0.1, pZPer); ripa.castShadow = true;
                grupoConstrucao.add(ripa);
            }
        }

        // 8. Piscina Colada ao Terreno
        if(optPiscina){
            const cP = 14; const lP = 8;
            let pXP = -(lado / 2) - (cP / 2) - 6;
            let pZP = 0;
            let altPiscina = colarElementoTerreno(pXP, pZP);

            const agua = new THREE.Mesh(new THREE.BoxGeometry(cP, 0.2, lP), materiaisCacheados['agua']);
            agua.position.set(pXP, altPiscina + 0.1, pZP); 
            grupoConstrucao.add(agua);
            
            const deck = new THREE.Mesh(new THREE.BoxGeometry(cP + 3.0, 0.1, lP + 3.0), new THREE.MeshPhysicalMaterial({ color: 0x52525b }));
            deck.position.copy(agua.position); deck.position.y = altPiscina + 0.05; deck.receiveShadow = true;
            grupoConstrucao.add(deck);
        }

        logNoTerminal("Compilação geométrica validada e injetada na VRAM.", "sys");
    }

    // ==========================================================================
    // 9. EVENTOS, FUROS MANUAIS E CICLO DE RENDER
    // ==========================================================================
    function aoClicarRato(ev){
        if(!ferramentaAtual){ return; }
        const cnt = document.getElementById('canvas-container');
        if(!cnt){ return; }
        const rect = cnt.getBoundingClientRect();
        rato.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
        rato.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1;

        raycasterFuros.setFromCamera(rato, camara);
        const inters = raycasterFuros.intersectObjects(grupoConstrucao.children);

        if(inters.length > 0){
            if(inters[0].object.userData.tipoObjeto === 'fachada'){
                instanciarFuroRealista(inters[0].point, inters[0].face.normal, ferramentaAtual);
                logNoTerminal(`Furo estrutural [${ferramentaAtual}] em X:${inters[0].point.x.toFixed(1)} Z:${inters[0].point.z.toFixed(1)}`, "sys");
            }else{
                logNoTerminal("Intersecção rejeitada. Selecione uma fachada primária.", "warn");
            }
        }
    }

    function instanciarFuroRealista(pto, norm, tipo){
        let l = tipo === 'porta' ? 2.2 : 1.8;
        let a = tipo === 'porta' ? 2.6 : 1.5;
        
        let malhaPlana;
        if(tipo === 'porta'){
            malhaPlana = new THREE.Mesh(new THREE.PlaneGeometry(l, a), materiaisCacheados['portaReal']);
            malhaPlana.position.copy(pto);
            const el = colarElementoTerreno(pto.x, pto.z);
            malhaPlana.position.y = Math.floor((malhaPlana.position.y - el) / 3.2) * 3.2 + el + (a / 2);
        }else{
            malhaPlana = new THREE.Mesh(new THREE.PlaneGeometry(l, a), materiaisCacheados['janelaReal']);
            malhaPlana.position.copy(pto);
        }

        malhaPlana.position.addScaledVector(norm, 0.08); 
        malhaPlana.lookAt(new THREE.Vector3().copy(malhaPlana.position).add(norm));
        malhaPlana.userData = { categoria: tipo };
        grupoConstrucao.add(malhaPlana);
        elementosAdicionados.push(malhaPlana);
    }

    function geradorOrcamento(){
        logNoTerminal("A compilar matriz financeira...", "sys");
        const area = parseFloat(lerValorID('area', '150', false)) || 150;
        const vAndares = parseInt(lerValorID('andares', '3', false)) || 3;
        const optGaragem = lerValorID('garagem', 'nenhuma', false);

        let totalBase = area * vAndares * 1350;
        if(lerValorID('assimetria', false, true)){ totalBase -= (area * 0.35 * 1350); }

        let cGaragem = 0;
        if(optGaragem !== 'nenhuma'){ cGaragem = 25000; }
        if(optGaragem === 'subterranea'){ cGaragem = 55000; }

        let nFuros = elementosAdicionados.length;
        let totalFinal = totalBase + cGaragem + (nFuros * 1200);

        const modal = document.getElementById('modal-orcamento');
        if(modal){
            document.getElementById('valor-total-modal').innerText = totalFinal.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR' }); 
            let ht = `<div class="line-item"><span>Edificação Bruta</span><span class="value">${totalBase.toLocaleString('pt-PT')} €</span></div>`;
            if(cGaragem > 0){ ht += `<div class="line-item"><span>Logística de Garagem</span><span class="value">${cGaragem.toLocaleString('pt-PT')} €</span></div>`; }
            
            document.getElementById('detalhes-descritivos').innerHTML = ht;
            modal.classList.add('ativo');
        }
    }

    function aoRedimensionar(){
        const cnt = document.getElementById('canvas-container');
        if(!cnt){ return; }
        camara.aspect = cnt.clientWidth / cnt.clientHeight;
        camara.updateProjectionMatrix();
        renderizador.setSize(cnt.clientWidth, cnt.clientHeight);
    }

    function loopMotor(){
        requestAnimationFrame(loopMotor);
        if(controlos && controlos.enabled){ controlos.update(); }
        if(renderizador && cena && camara){ renderizador.render(cena, camara); }
        
        frames++;
        let agora = performance.now();
        if(agora - ultimoTempoFPS >= 1000){
            const label = document.getElementById('fps-counter');
            if(label){ label.innerText = `FPS: ${frames}`; }
            frames = 0; ultimoTempoFPS = agora;
        }
    }

    return {
        iniciar: arrancar,
        atualizarGeometria: atualizarConstrucao,
        calcularOrcamento: geradorOrcamento,
        atualizarInterface: function(){}
    };
})();

window.onload = App.iniciar;