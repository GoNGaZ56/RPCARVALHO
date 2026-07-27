<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
    <meta name="description" content="Motor CAD PRO R.F. Carvalho para simulação de obra, lote, muros, anexos e orçamento estimativo.">
    <title>Motor CAD PRO - R.F. CARVALHO</title>
    <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'><rect width='100' height='100' rx='22' fill='%2322c55e'/><text x='50' y='67' text-anchor='middle' font-size='55'>🏗️</text></svg>">
    <script src="https://cdnjs.cloudflare.com/ajax/libs/three.js/r128/three.min.js"></script>
    <script src="https://cdn.jsdelivr.net/npm/three@0.128.0/examples/js/controls/OrbitControls.js"></script>
    <link rel="stylesheet" href="CSS/style.css">
</head>
<body data-mode="pro">
    <div id="loading-screen">
        <div class="loader-cad"></div>
        <p class="loading-text">A preparar simulador 3D...</p>
        <p id="loading-hardware" class="loading-hardware">A otimizar para o dispositivo...</p>
    </div>

    <header class="app-header">
        <a href="index.php" class="logo-container logo-link"><span class="logo-icon">🏗️</span> R.F. CARVALHO <span class="badge">PRO CAD</span></a>
        <button type="button" class="mobile-panel-toggle" onclick="App.alternarPainel()">Opções</button>
        <div class="header-actions">
            <button id="btn-dark-mode" class="btn-outline-primary" type="button">TEMA</button>
            <button class="btn-outline-primary" type="button" onclick="App.mostrarAjuda()">AJUDA</button>
            <a href="simulador-simples.php" class="btn-outline-primary">MODO BÁSICO</a>
            <a href="index.php" class="btn-outline-danger">SAIR</a>
        </div>
    </header>

    <main class="app-workspace">
        <aside id="control-panel" class="control-panel scrollable-y">
            <div class="panel-title-box">
                <span class="eyebrow">Simulação PRO</span>
                <h1>Configuração da obra</h1>
                <p>As opções avançadas só aparecem quando o elemento correspondente está ativo.</p>
            </div>

            <div class="panel-section">
                <div class="section-header"><h3>1. Terreno e acesso</h3></div>
                <label for="terreno">Relevo topográfico</label>
                <select id="terreno" class="custom-select js-auto-update">
                    <option value="normal" selected>Plano / nivelado</option>
                    <option value="encosta">Encosta moderada</option>
                    <option value="montanha">Declive acentuado</option>
                </select>
                <div class="form-row">
                    <div class="form-group half"><label for="area-terreno">Área do terreno (m²)</label><input type="number" id="area-terreno" class="custom-input js-auto-update" value="900" min="350" max="20000" step="25"></div>
                    <div class="form-group half"><label for="formato-terreno">Formato do lote</label><select id="formato-terreno" class="custom-select js-auto-update"><option value="irregular" selected>Irregular suave</option><option value="trapezio">Trapézio</option><option value="retangular">Retangular</option></select></div>
                </div>
                <label for="posicao-casa">Casa no terreno</label>
                <select id="posicao-casa" class="custom-select js-auto-update"><option value="central" selected>Centralizada</option><option value="frente">Mais à frente</option><option value="tras">Mais atrás</option><option value="esquerda">Mais à esquerda</option><option value="direita">Mais à direita</option></select>
                <div class="form-row">
                    <div class="form-group half"><label for="estrada">Estrada exterior</label><select id="estrada" class="custom-select js-auto-update"><option value="frente" selected>Frente / Sul</option><option value="tras">Traseiras / Norte</option><option value="esquerda">Lateral esquerda</option><option value="direita">Lateral direita</option><option value="nenhuma">Sem estrada</option></select></div>
                    <div class="form-group half conditional" data-show-when="estrada:frente,tras,esquerda,direita"><label for="entrada-lote">Entrada no lote</label><select id="entrada-lote" class="custom-select js-auto-update"><option value="alinhada" selected>Alinhada ao portão</option><option value="esquerda">Portão à esquerda</option><option value="direita">Portão à direita</option></select></div>
                </div>
                <label for="tipo-planta">Massa florestal</label>
                <select id="tipo-planta" class="custom-select js-auto-update">
                    <option value="nenhuma" selected>Sem vegetação automática</option>
                    <option value="arvores">Árvores folhosas</option>
                    <option value="palmeiras">Palmeiras</option>
                    <option value="misto">Misto controlado</option>
                </select>
                <div class="conditional" data-show-when="tipo-planta:arvores,palmeiras,misto">
                    <label for="densidade-arvores">Densidade</label>
                    <select id="densidade-arvores" class="custom-select js-auto-update"><option value="baixa" selected>Baixa</option><option value="media">Média</option></select>
                </div>
            </div>

            <div class="panel-section">
                <div class="section-header"><h3>2. Vedação / muro</h3></div>
                <label for="tipo-muro">Vedação</label>
                <select id="tipo-muro" class="custom-select js-auto-update">
                    <option value="nenhum" selected>Sem vedação</option>
                    <option value="betao">Muro de betão</option>
                    <option value="vegetacao">Sebe viva</option>
                    <option value="vidro">Vidro / guarda</option>
                </select>
                <div class="conditional" data-show-when="tipo-muro:betao,vegetacao,vidro">
                    <div class="form-row">
                        <div class="form-group half"><label for="tracado-muro">Formato do muro</label><select id="tracado-muro" class="custom-select js-auto-update"><option value="reto" selected>Reto</option><option value="misto">Cantos arredondados</option></select></div>
                        <div class="form-group half"><label for="area-muro">Área muro manual (m²)</label><input type="number" id="area-muro" class="custom-input js-auto-update" value="0" min="0" max="20000" step="1"></div>
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <div class="section-header"><h3>3. Construção principal</h3></div>
                <div class="form-row">
                    <div class="form-group half"><label for="tipo">Tipologia</label><select id="tipo" class="custom-select js-auto-update"><option value="moradia" selected>Moradia</option><option value="vivenda">Vivendas geminadas</option><option value="predio">Prédio / bloco</option></select></div>
                    <div class="form-group half"><label for="area">Área base por unidade (m²)</label><input type="number" id="area" class="custom-input js-auto-update" value="120" min="45" max="2500" step="5"></div>
                </div>
                <label for="estilo-casa">Estilo da casa</label>
                <select id="estilo-casa" class="custom-select js-auto-update">
                    <option value="moderno" selected>Moderno / linhas direitas</option>
                    <option value="tradicional">Tradicional / antigo</option>
                    <option value="rustico">Rústico / pedra e madeira</option>
                </select>
                <div class="conditional" data-show-when="tipo:vivenda">
                    <div class="form-row">
                        <div class="form-group half"><label for="vivendas-qtd">Quantidade de vivendas</label><input type="number" id="vivendas-qtd" class="custom-input js-auto-update" value="2" min="2" max="8" step="1"></div>
                        <div class="form-group half"><label for="vivendas-disposicao">Disposição</label><select id="vivendas-disposicao" class="custom-select js-auto-update"><option value="geminadas" selected>Geminadas</option><option value="banda">Em banda</option><option value="separadas">Separadas</option></select></div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group half"><label for="andares">Pisos</label><input type="number" id="andares" class="custom-input js-auto-update" value="1" min="1" max="12" step="1"></div>
                    <div class="form-group half"><label for="assimetria">Volumes recuados</label><select id="assimetria" class="custom-select js-auto-update"><option value="0" selected>Não</option><option value="1">Sim</option></select></div>
                </div>
            </div>

            <div class="panel-section">
                <div class="section-header"><h3>4. Garagem</h3></div>
                <label for="garagem">Tipo de garagem</label>
                <select id="garagem" class="custom-select js-auto-update">
                    <option value="nenhuma" selected>Sem garagem</option>
                    <option value="integrada">No mesmo edifício da casa</option>
                    <option value="colada_esq">Colada à casa - esquerda</option>
                    <option value="colada_dir">Colada à casa - direita</option>
                    <option value="colada_frente">Colada à casa - frente</option>
                    <option value="colada_tras">Colada à casa - traseiras</option>
                    <option value="subterranea">Subterrânea / cave apenas no orçamento</option>
                </select>
                <div class="conditional" data-show-when="garagem:integrada,colada_esq,colada_dir,colada_frente,colada_tras">
                    <div class="form-row">
                        <div class="form-group half"><label for="garagem-portoes">Portões de garagem</label><input type="number" id="garagem-portoes" class="custom-input js-auto-update" value="1" min="1" max="4" step="1"></div>
                        <div class="form-group half"><label for="garagem-porta-lateral">Porta lateral</label><select id="garagem-porta-lateral" class="custom-select js-auto-update"><option value="1" selected>Sim</option><option value="0">Não</option></select></div>
                    </div>
                </div>
                <div class="conditional note-box" data-show-when="garagem:subterranea">
                    A garagem subterrânea entra no orçamento, mas não altera a geometria para evitar deformações falsas no terreno.
                </div>
            </div>

            <div class="panel-section">
                <div class="section-header"><h3>5. Cobertura</h3></div>
                <label for="telhado">Tipo de telhado</label>
                <select id="telhado" class="custom-select js-auto-update">
                    <option value="plano" selected>Plano / platibanda</option>
                    <option value="uma_agua">Uma água</option>
                    <option value="duas_aguas">Duas águas</option>
                    <option value="quatro_aguas">Quatro águas</option>
                    <option value="beiral">Telha com beiral</option>
                    <option value="sandwich">Painel sandwich</option>
                </select>
                <div class="conditional" data-show-when="telhado:uma_agua,duas_aguas,quatro_aguas,beiral,sandwich">
                    <div class="form-row">
                        <div class="form-group half"><label for="orientacao-telhado">Orientação</label><select id="orientacao-telhado" class="custom-select js-auto-update"><option value="frente_tras" selected>Cumeeira frente/trás</option><option value="esquerda_direita">Cumeeira esquerda/direita</option></select></div>
                        <div class="form-group half"><label for="inclinacao-telhado">Inclinação</label><select id="inclinacao-telhado" class="custom-select js-auto-update"><option value="baixa">Baixa</option><option value="media" selected>Média</option><option value="alta">Alta</option></select></div>
                    </div>
                </div>
                <div class="form-row">
                    <div class="form-group half"><label for="claraboia">Claraboias</label><select id="claraboia" class="custom-select js-auto-update"><option value="0" selected>0</option><option value="1">1</option><option value="2">2</option><option value="3">3</option></select></div>
                    <div class="form-group half"><label for="paineis-solares">Fotovoltaicos</label><select id="paineis-solares" class="custom-select js-auto-update"><option value="0" selected>Não</option><option value="1">Sim</option></select></div>
                </div>
            </div>

            <div class="panel-section">
                <div class="section-header"><h3>6. Anexos</h3></div>
                <label for="anexos">Adicionar anexo</label>
                <select id="anexos" class="custom-select js-auto-update">
                    <option value="nenhum" selected>Sem anexo</option>
                    <option value="arrumos">Arrumos</option>
                    <option value="oficina">Oficina / apoio técnico</option>
                    <option value="garagem">Garagem independente</option>
                    <option value="lazer">Anexo de lazer</option>
                </select>
                <div class="conditional" data-show-when="anexos:arrumos,oficina,garagem,lazer">
                    <div class="form-row">
                        <div class="form-group half"><label for="posicao-anexo">Posição</label><select id="posicao-anexo" class="custom-select js-auto-update"><option value="direita" selected>Direita do lote</option><option value="esquerda">Esquerda do lote</option><option value="frente">Frente</option><option value="tras">Traseiras</option></select></div>
                        <div class="form-group half"><label for="portas-anexo">Portas laterais</label><input type="number" id="portas-anexo" class="custom-input js-auto-update" value="1" min="0" max="4" step="1"></div>
                    </div>
                    <label for="anexo-telhado">Tipo de telhado do anexo</label>
                    <select id="anexo-telhado" class="custom-select js-auto-update">
                        <option value="plano">Plano / platibanda</option>
                        <option value="uma_agua" selected>Uma água</option>
                        <option value="duas_aguas">Duas águas</option>
                        <option value="quatro_aguas">Quatro águas</option>
                        <option value="beiral">Telha com beiral</option>
                        <option value="sandwich">Painel sandwich</option>
                    </select>
                    <input type="hidden" id="anexo-manual" class="js-auto-update" value="0">
                    <input type="hidden" id="anexo-x" class="js-auto-update" value="0">
                    <input type="hidden" id="anexo-z" class="js-auto-update" value="0">
                    <p class="small-note">Para mover o anexo livremente, use o botão lápis no 3D e selecione “Mover anexo”.</p>
                    <div class="conditional" data-show-when="anexos:garagem,oficina">
                        <label for="garagem-anexo-portoes">Portões do anexo</label>
                        <input type="number" id="garagem-anexo-portoes" class="custom-input js-auto-update" value="1" min="1" max="4" step="1">
                    </div>
                </div>
            </div>

            <div class="panel-section">
                <div class="section-header"><h3>7. Piscina</h3></div>
                <div class="toggle-group"><label class="toggle-switch"><input type="checkbox" id="piscina" class="js-auto-update"><span class="slider"></span></label><span class="toggle-label">Adicionar piscina</span></div>
                <div class="conditional" data-show-when="piscina:true">
                    <div class="form-row">
                        <div class="form-group half"><label for="posicao-piscina">Posição</label><select id="posicao-piscina" class="custom-select js-auto-update"><option value="tras" selected>Traseiras</option><option value="frente">Frente</option><option value="esquerda">Esquerda</option><option value="direita">Direita</option></select></div>
                        <div class="form-group half"><label for="piscina-comprimento">Comprimento (m)</label><input type="number" id="piscina-comprimento" class="custom-input js-auto-update" value="8" min="4" max="30" step="0.5"></div>
                    </div>
                    <label for="piscina-largura">Largura (m)</label>
                    <input type="number" id="piscina-largura" class="custom-input js-auto-update" value="4" min="2.5" max="15" step="0.5">
                    <input type="hidden" id="piscina-manual" class="js-auto-update" value="0">
                    <input type="hidden" id="piscina-x" class="js-auto-update" value="0">
                    <input type="hidden" id="piscina-z" class="js-auto-update" value="0">
                    <p class="small-note">Para posicionar livremente, use o botão lápis no 3D e selecione “Mover piscina”.</p>
                </div>
            </div>


            <div class="panel-section active-summary-panel">
                <div class="section-header"><h3>Resumo do que está colocado</h3></div>
                <div id="resumo-elementos" class="active-summary-list"></div>
            </div>

            <div class="panel-section terms-section">
                <div class="section-header"><h3>Responsabilidade</h3></div>
                <button type="button" class="btn-link-like" onclick="App.mostrarTermos()">Ler termos de responsabilidade</button>
                <div class="toggle-group"><label class="toggle-switch"><input type="checkbox" id="termos-responsabilidade"><span class="slider"></span></label><span class="toggle-label">Li e aceito que a simulação é apenas indicativa.</span></div>
                <button class="btn-success-massive" type="button" onclick="App.calcularOrcamento()">Gerar relatório</button>
                <div class="action-row"><button type="button" class="btn-action" onclick="App.guardarProjeto()">Guardar XML</button><button type="button" class="btn-action" onclick="App.exportarXML()">Exportar XML</button><button type="button" class="btn-action" onclick="App.importarXML()">Importar XML</button><button type="button" class="btn-action" onclick="App.exportarImagem()">Imagem</button></div>
                <input type="file" id="file-import" accept=".xml,.json" hidden>
            </div>
        </aside>

        <section class="viewport-container">
            <div id="canvas-container"></div>
            <div class="canvas-tools" id="canvas-tools">
                <button type="button" class="canvas-tool-main" id="btn-ferramentas-3d" title="Adicionar elementos no 3D" onclick="App.alternarFerramentas3D()">✎</button>
                <div class="canvas-tool-palette" id="ferramentas-3d-palette">
                    <button type="button" data-tool="arvore">Árvore</button>
                    <button type="button" data-tool="palmeira">Palmeira</button>
                    <button type="button" data-tool="planta">Planta</button>
                    <button type="button" data-tool="pedra">Pedra</button>
                    <button type="button" data-tool="candeeiro">Candeeiro</button>
                    <button type="button" data-tool="deck">Deck</button>
                    <button type="button" data-tool="pergola">Pérgola</button>
                    <button type="button" data-tool="churrasqueira">Churrasqueira</button>
                    <button type="button" data-tool="mover_piscina">Mover piscina</button>
                    <button type="button" data-tool="mover_anexo">Mover anexo</button>
                    <button type="button" class="danger" onclick="App.limparManuais()">Limpar extras</button>
                </div>
            </div>
            <div class="hud-card"><span>Área total</span><strong id="hud-area">0 m²</strong><span>Estimativa</span><strong id="hud-preco">0 €</strong></div>
            <div id="dev-console"><div class="console-header"><span>R.F. CARVALHO ENGINE</span><span id="fps-counter">FPS: --</span></div><div id="console-logs"></div></div>
            <div id="modal-sistema" class="modal-backdrop"></div>
            <div id="modal-orcamento" class="modal-backdrop"></div>
        </section>
    </main>

    <script src="JS/simulador.js"></script>
</body>
</html>
