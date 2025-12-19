
var currentCytoscapeInstance = null;
var textTraceHistory = [];
var autoDelayTimer = null;
var currentMermaidMode = 'full'; // 'full', 'simple', 'lts'
var currentEdgeStyle = 'straight';
var storedDelayValue = 1.0; 
var jsTextHistory = [];



window.stopAutoDelay = stopAutoDelay;

$(document).on('shown.bs.tab', 'a[data-toggle="tab"]', function (e) {
    var target = $(e.target).attr("href"); 
    
    if (target === '#mermaidTab') {
        setTimeout(function() {
            renderMermaidView();
        }, 10);
    }
});

document.addEventListener("DOMContentLoaded", function() {
    try {
        var examplesJson = RTA.getExamples();
        var examples = JSON.parse(examplesJson);
        var select = document.getElementById("examplesSelect");
        
        select.innerHTML = '<option value="">Carregar Exemplo...</option>';
        
        for (var key in examples) {
            var opt = document.createElement("option");
            opt.value = examples[key];
            opt.innerHTML = key;
            select.appendChild(opt);
        }
    } catch(e) { console.error("Erro ao carregar exemplos", e); }
});



function updateAllViews(jsonResponse) {
    if (!jsonResponse || jsonResponse.startsWith('{"error"')) {
        console.error("Erro na resposta:", jsonResponse);
        return; 
    }

    var data = JSON.parse(jsonResponse);

    renderCytoscapeGraph("cytoscapeMainContainer", data, false);

    renderGlobalPanel(data);

    var activeTab = document.querySelector('.nav-tabs li.active a').getAttribute('href');
    if (activeTab === '#mermaidTab') renderMermaidView();
    if (activeTab === '#txtTab') renderTextView();
    
    if (data.lastTransition) {
         textTraceHistory.push(data.lastTransition.to);
    } else if (data.panelData && !data.panelData.canUndo) {
         textTraceHistory = []; 
    }
}



function renderCytoscapeGraph(mainContainerId, dataOrJson, isFirstRender) {
    var mainContainer = document.getElementById(mainContainerId);
    if (!mainContainer) return;

    var data = (typeof dataOrJson === 'string') ? JSON.parse(dataOrJson) : dataOrJson;
    var sourceCode = (typeof editor !== 'undefined') ? editor.getValue() : "";
    applySavedPositions(data.graphElements, sourceCode);
    if (isFirstRender || !currentCytoscapeInstance) {
        setupInitialCytoscape(mainContainerId, data);
        return;
    }

    try {
        if (currentCytoscapeInstance) {
            currentCytoscapeInstance.json({ elements: data.graphElements });
            
            if (data.lastTransition) {
                var trans = data.lastTransition;
                var actionNodeId = `event_${trans.from}_${trans.to}_${trans.lbl}`;
                var edgeTo  = `s_to_a_${trans.from}_${actionNodeId}`;
                var edgeFrom = `a_to_s_${actionNodeId}_${trans.to}`;
                
                var elementsToFlash = currentCytoscapeInstance.elements(`#${actionNodeId}, #${edgeTo}, #${edgeFrom}`);
                if (elementsToFlash.length > 0) {
                    elementsToFlash.addClass('transition-flash');
                    setTimeout(() => elementsToFlash.removeClass('transition-flash'), 1000); 
                }
            }
        }
    } catch (e) {
        console.error("Erro ao atualizar grafo, recriando...", e);
        setupInitialCytoscape(mainContainerId, data);
    }
}


function formatCode(code) {
    if (!code) return "";
    
    let formatted = code
        .replace(/;/g, ";\n")
        
        .replace(/(\d)if/g, "$1\nif")
        
        .replace(/\sif\s/g, "\nif ")
        .replace(/\sif\(/g, "\nif (")

        .replace(/\{/g, " {\n    ")      
        .replace(/\}/g, "\n}")           
        
        .replace(/then/g, " then ")    
        .replace(/AND/g, " AND\n    ") 

        .replace(/  +/g, ' ')       
        .replace(/\n\s*/g, "\n    ") 
        .replace(/\n    \}/g, "\n}"); 

    return formatted.trim();
}

async function setupInitialCytoscape(mainContainerId, data) {
    var mainContainer = document.getElementById(mainContainerId);
    
    mainContainer.innerHTML = '';
    mainContainer.style.display = 'block'; 
    mainContainer.style.width = '100%';
    mainContainer.style.height = '100%';

    var sourceCode = (typeof editor !== 'undefined') ? editor.getValue() : JSON.stringify(data.graphElements);
    
    const simpleHash = s => {
        let h = 0; 
        for(let i=0; i<s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
        return String(h);
    };
    const graphId = simpleHash(sourceCode);

    if (!hasExistingLayoutsInLocalStorage()) {
        await loadDefaultLayoutsFromSeedFile();
    }


    var hasSavedLayout = applySavedPositions(data.graphElements, sourceCode);


    let layoutOptions = { 
        name: hasSavedLayout ? 'preset' : 'dagre', 
        rankDir: 'LR', 
        fit: true, 
        padding: 50, 
        spacingFactor: 1.2,
        animate: false 
    };

    var cy = cytoscape({
        container: mainContainer, 
        elements: data.graphElements, 
        style: getCytoscapeStyles(), 
        layout: layoutOptions,
        wheelSensitivity: 0.2,
        textureOnViewport: true,
        pixelRatio: 1
    });

    
    let saveTimeout;
    cy.on('dragfree', 'node', function() { 
        clearTimeout(saveTimeout);
        saveTimeout = setTimeout(() => {
            autoSaveLayoutToLocalStorage(cy, graphId);
        }, 500);
    });
    
    cy.on('tap', 'node.event-node.enabled', function(evt){
        var node = evt.target;
        var parts = node.id().split('_');
        if (parts.length >= 4) {
            var from = parts[1]; var to = parts[2]; var lbl = parts.slice(3).join('_');
            var edgeJson = JSON.stringify({ "from": from, "to": to, "lbl": lbl });
            
            var responseJson = RTA.takeStep(edgeJson);
            var newStateText = RTA.getCurrentStateText();
            jsTextHistory.push({ label: lbl + " ->", text: newStateText });

            updateAllViews(responseJson);
        }
    });

    cy.on('mouseover', 'node.event-node.enabled', (e) => e.cy.container().style.cursor = 'pointer');
    cy.on('mouseout', 'node.event-node.enabled', (e) => e.cy.container().style.cursor = 'default');
    
    cy.on('tap', 'edge.has-details', function(evt){
        var edge = evt.target;
        var rawText = edge.data('full_label');
        var formattedText = formatCode(rawText);
        var contentPre = document.getElementById('edgeDetailContent');
        contentPre.textContent = formattedText;
        
        if (typeof Prism !== 'undefined') {
            contentPre.className = "language-clike"; 
            Prism.highlightElement(contentPre);
        }
        $('#edgeDetailModal').modal('show');
    });

    currentCytoscapeInstance = cy;

    setupContextMenu(cy);
}


function changeEdgeStyle(styleName) {
    if (!currentCytoscapeInstance) return;
    currentEdgeStyle = styleName;

    var edges = currentCytoscapeInstance.edges();
    edges.removeClass('taxi bezier straight');

    if (styleName === 'taxi') {
        edges.style({ 'curve-style': 'taxi', 'taxi-direction': 'vertical' });
    } else if (styleName === 'bezier') {
        edges.style({ 'curve-style': 'bezier', 'control-point-step-size': 40 });
    } else {
        edges.style({ 'curve-style': 'straight' });
    }
}

function renderGlobalPanel(data) {
    var panelDiv = document.getElementById('sidePanel');
    if (!panelDiv) return;

    panelDiv.innerHTML = '';
    var panelData = data.panelData;

    var undoBtn = document.createElement('button');
    undoBtn.className = 'btn btn-warning btn-block btn-sm';
    undoBtn.innerHTML = '<span class="glyphicon glyphicon-step-backward"></span> Desfazer (Undo)';
    undoBtn.disabled = !panelData.canUndo;
    undoBtn.style.marginBottom = '15px';
    undoBtn.onclick = function() {
        var json = RTA.undo();
        if (jsTextHistory.length > 1) {
            jsTextHistory.pop();
        }
        updateAllViews(json);
    };
    panelDiv.appendChild(undoBtn);

    if ((panelData.clocks && Object.keys(panelData.clocks).length > 0) || 
        (panelData.variables && Object.keys(panelData.variables).length > 0)) {
        
        var varHeader = document.createElement('h5');
        varHeader.innerText = "Estado:";
        panelDiv.appendChild(varHeader);

        var infoList = document.createElement('ul');
        infoList.className = "list-unstyled";
        infoList.style.fontSize = "12px";
        infoList.style.background = "#fff";
        infoList.style.padding = "10px";
        infoList.style.border = "1px solid #ddd";
        infoList.style.borderRadius = "4px";
        
        for (let [k, v] of Object.entries(panelData.clocks || {})) {
            let li = document.createElement('li');
            li.innerHTML = `<span class="text-info">🕒 ${k}</span>: <b>${v.toFixed(5)}</b>`;
            infoList.appendChild(li);
        }
        for (let [k, v] of Object.entries(panelData.variables || {})) {
            let li = document.createElement('li');
            li.innerHTML = `<span class="text-success"># ${k}</span>: <b>${v}</b>`;
            infoList.appendChild(li);
        }
        panelDiv.appendChild(infoList);
        panelDiv.appendChild(document.createElement('hr'));
    }

    var transHeader = document.createElement('h5');
    transHeader.innerText = "Transições Habilitadas:";
    panelDiv.appendChild(transHeader);

    if (panelData.enabled.length === 0) {
        var dead = document.createElement('div');
        dead.className = "alert alert-danger text-center";
        dead.style.padding = "5px";
        dead.innerText = "DEADLOCK";
        panelDiv.appendChild(dead);
    } else {
        panelData.enabled.forEach(function(edge) {
            var btnGroup = document.createElement('div');
            
            if (edge.isDelay) {
                btnGroup.className = 'input-group input-group-sm';
                btnGroup.style.marginBottom = '5px';
                
                var input = document.createElement('input');
                input.type = 'number';
                input.className = 'form-control';
                input.value = storedDelayValue; 
                input.step = '0.001';
                input.min = '0.000001';
                input.id = 'delayInputVal';

                input.onchange = function() {
                    var val = parseFloat(this.value);
                    if (!isNaN(val)) {
                        storedDelayValue = val;
                    }
                };

                var spanBtn = document.createElement('span');
                spanBtn.className = 'input-group-btn';
                
                var btn = document.createElement('button');
                btn.className = 'btn btn-default';
                btn.innerHTML = '⏱ Delay';
                btn.onclick = function() {
                    var val = parseFloat(input.value);
                    storedDelayValue = val; 
                    var json = RTA.advanceTime(val);
                    updateAllViews(json);
                };
                
                spanBtn.appendChild(btn);
                btnGroup.appendChild(input);
                btnGroup.appendChild(spanBtn);
                panelDiv.appendChild(btnGroup);

            } else {
                var btn = document.createElement('button');
                btn.className = 'btn btn-default btn-block btn-sm';
                btn.style.textAlign = 'left';
                btn.style.marginBottom = '4px';
                btn.innerText = edge.label;
                btn.onclick = function() {
                    stopAutoDelay(); 
                    var json = RTA.takeStep(JSON.stringify(edge));
                    var newStateText = RTA.getCurrentStateText();
                    jsTextHistory.push({ label: edge.label + " ->", text: newStateText });
                    updateAllViews(json);
                };
                panelDiv.appendChild(btn);
            }
        });
    }

    panelDiv.appendChild(document.createElement('hr'));

    
    var panelGroup = document.createElement('div');
    panelGroup.className = 'panel-group';
    panelGroup.id = 'layoutSettingsGroup'; 
    panelGroup.style.marginBottom = '10px';

    var layoutPanel = document.createElement('div');
    layoutPanel.className = 'panel panel-default';

    var panelHeading = document.createElement('div');
    panelHeading.className = 'panel-heading';
    panelHeading.style.padding = '5px 10px';
    
    var titleHtml = `
        <h4 class="panel-title" style="font-size: 12px;">
            <a data-toggle="collapse" href="#collapseLayout" style="text-decoration: none; display: block;">
                <span class="glyphicon glyphicon-cog"></span> Configurações de Layout <span class="caret"></span>
            </a>
        </h4>`;
    panelHeading.innerHTML = titleHtml;

    var collapseBody = document.createElement('div');
    collapseBody.id = 'collapseLayout';
    collapseBody.className = 'panel-collapse collapse'; 

    var panelBody = document.createElement('div');
    panelBody.className = 'panel-body';

    renderLayoutControls(panelBody);

    collapseBody.appendChild(panelBody);
    layoutPanel.appendChild(panelHeading);
    layoutPanel.appendChild(collapseBody);
    panelGroup.appendChild(layoutPanel);

    panelDiv.appendChild(panelGroup);
}

function renderLayoutControls(container) {
    var layoutGroup = document.createElement('div');
    layoutGroup.className = 'form-group';
    
    var layoutLabel = document.createElement('label');
    layoutLabel.innerText = 'Layout:';
    layoutLabel.style.fontSize = '12px';
    
    var layoutSelect = document.createElement('select');
    layoutSelect.className = 'form-control input-sm';
    layoutSelect.innerHTML = `
        <option value="preset">Sincronizado (Preset)</option>
        <option value="dagre" selected>Hierárquico (Dagre)</option>
        <option value="cose">Forças (Cose)</option>
        <option value="circle">Circular</option>
        <option value="grid">Grade</option>
        <option value="random">Aleatório</option>
    `;
    
    layoutSelect.onchange = function(e) {
        if (!currentCytoscapeInstance) return;
        var layoutName = e.target.value;
        var options = { name: layoutName, fit: true, padding: 50, animate: true };
        
        if (layoutName === 'dagre') options.rankDir = 'LR';
        if (layoutName === 'cose') { options.componentSpacing = 40; options.nodeRepulsion = 8000; }
        
        currentCytoscapeInstance.layout(options).run();
    };

    layoutGroup.appendChild(layoutLabel);
    layoutGroup.appendChild(layoutSelect);
    container.appendChild(layoutGroup);

    var styleGroup = document.createElement('div');
    styleGroup.className = 'form-group';
    
    var styleLabel = document.createElement('label');
    styleLabel.innerText = 'Estilo de Aresta:';
    styleLabel.style.fontSize = '12px';
    
    var styleSelect = document.createElement('select');
    styleSelect.className = 'form-control input-sm';
    styleSelect.innerHTML = `
        <option value="straight">Direto</option>
        <option value="taxi">Reto (Taxi)</option>
        <option value="bezier">Curvo (Bezier)</option>
    `;
    
    styleSelect.value = currentEdgeStyle || 'straight';

    styleSelect.onchange = function(e) {
        changeEdgeStyle(e.target.value);importAllLayoutsFromFile
    };

    styleGroup.appendChild(styleLabel);
    styleGroup.appendChild(styleSelect);
    container.appendChild(styleGroup);

    container.appendChild(document.createElement('hr'));

    var btnGroup = document.createElement('div');
    btnGroup.className = 'btn-group-vertical btn-block';
    
    var saveBtn = document.createElement('button');
    saveBtn.className = 'btn btn-default btn-sm';
    saveBtn.innerText = 'Salvar Layout';
    saveBtn.onclick = exportAllLayoutsToFile;
    
    var loadBtn = document.createElement('button');
    loadBtn.className = 'btn btn-default btn-sm';
    loadBtn.innerText = 'Carregar Layout';
    loadBtn.onclick = function() {
        document.getElementById('hiddenFileInput').click();
    };

    if (!document.getElementById('hiddenFileInput')) {
        var fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.id = 'hiddenFileInput';
        fileInput.style.display = 'none';
        fileInput.accept = '.json,application/json';
        fileInput.onchange = function(e) {
            var file = e.target.files[0];
            if (!file) return;
            var reader = new FileReader();
            reader.onload = function(evt) {
                importAllLayoutsFromFile(currentCytoscapeInstance, null, evt.target.result);
            };
            reader.readAsText(file);
            e.target.value = ''; 
        };
        document.body.appendChild(fileInput);
    }

    btnGroup.appendChild(saveBtn);
    btnGroup.appendChild(loadBtn);
    container.appendChild(btnGroup);
}



function renderTextView() {
    var container = document.getElementById("textContainer");
    
    if (jsTextHistory.length === 0) {
        container.innerHTML = "<p class='text-muted' style='padding:20px'>Modelo vazio.</p>";
        return;
    }

    var fullHtml = "";

    jsTextHistory.forEach(function(item) {

        
        var formattedState = parseStateText(item.text);

        fullHtml += `
            <div class="history-row">
                <div class="history-label">${item.label}</div>
                <div class="history-content">${formattedState}</div>
            </div>
        `;
    });

    container.innerHTML = fullHtml;

    setTimeout(function() {
        container.scrollTop = container.scrollHeight;
    }, 50);
}

function setMermaidMode(mode) {
    currentMermaidMode = mode;
    renderMermaidView();
}

function showLTS() {
    setMermaidMode('lts');
    $('.nav-tabs a[href="#mermaidTab"]').tab('show'); 
}

function parseStateText(rawText) {
    if (!rawText) return "";
    var lines = rawText.split('\n');
    var html = "";

    lines.forEach(function(line) {
        line = line.trim();
        if (!line) return;

        var match = line.match(/^\[(.*?)\]\s*(.*)/);
        if (match) {
            var key = match[1].toLowerCase();
            var content = match[2];
            var icon = "🔹";
            var inner = content;

            if (key === 'init') { icon = "🚩"; inner = `<span class="tv-tag highlight">${content}</span>`; }
            else if (key === 'act') { 
                icon = "⚡"; 
                inner = content.split(',').map(s => `<span class="tv-tag active">${s.trim()}</span>`).join(" ");
            }
            else if (key === 'clocks' || key === 'vars') { icon = "#️⃣"; }
            else if (key === 'on') { icon = "🟢"; }
            else if (key === 'off') { icon = "🔴"; inner = `<span class="tv-tag disabled">${content}</span>`; }

            html += `<div class="tv-section"><span class="tv-header">${icon} ${key}: </span><span class="tv-content">${inner}</span></div>`;
        } else {
            html += `<div style="padding-left:20px; font-size:11px; color:#777;">${line}</div>`;
        }
    });
    return html;
}

function renderMermaidView() {
    var container = document.getElementById('mermaidContainer');
    if (!container) return;

    if (container.offsetParent === null) {
        return; 
    }

    var mermaidCode = "";
    
    if (!currentMermaidMode) currentMermaidMode = 'full';

    if (currentMermaidMode === 'lts') {
        mermaidCode = RTA.getAllStepsMermaid(); 
    } else if (currentMermaidMode === 'simple') {
        mermaidCode = RTA.getCurrentStateMermaidSimple();
    } else {
        mermaidCode = RTA.getCurrentStateMermaid();
    }

    if (!mermaidCode || mermaidCode.trim() === "") {
        container.innerHTML = "<p class='text-muted'>Nenhum gráfico para exibir.</p>";
        return;
    }

    container.innerHTML = mermaidCode;
    container.removeAttribute('data-processed'); 

    try {
        mermaid.init(undefined, container);
    } catch (e) {
        console.error("Mermaid Error:", e);
    }
}




function downloadString(filename, content) {
    var blob = new Blob([content], {type: 'text/plain'});
    var a = document.createElement('a');
    a.href = window.URL.createObjectURL(blob);
    a.download = filename;
    a.click();
}

function downloadMcrl2() { downloadString("model.mcrl2", RTA.getMcrl2()); }

function downloadUppaal(loadAndRendertype) {
    var content = ""; var name = "model.xml";
    if (type === 'glts') { content = RTA.getUppaalGLTS(); name = "model_glts.xml"; }
    else if (type === 'rg') { content = RTA.getUppaalRG(); name = "model_rg.xml"; }
    else if (type === 'tgrg') { content = RTA.getUppaalTGRG(); name = "model_tgrg.xml"; }
    
    if(content) downloadString(name, content);
    else alert("Modelo não carregado.");
}



function showStats() {
    document.getElementById("analysisResult").innerText = RTA.getStats();
}

function checkProblems() {
    document.getElementById("analysisResult").innerText = RTA.checkProblems();
}

function stopAutoDelay() {
    if (autoDelayTimer) {
        clearInterval(autoDelayTimer);
        autoDelayTimer = null;
    }
}

function toggleAutoDelay(isChecked) {
    if (isChecked) {
        if (autoDelayTimer) return; 
        const runStep = () => {
            var inp = document.getElementById('delayInputVal');
            var delay = inp ? parseFloat(inp.value) : 1.0;
            var json = RTA.advanceTime(delay);
            updateAllViews(json);
        };
        runStep(); 
        autoDelayTimer = setInterval(runStep, 1000); 
    } else {
        stopAutoDelay();
    }
}


function applySavedPositions(graphElements, sourceCode) {
    const simpleHash = s => {
        let h = 0; for(let i=0; i<s.length; i++) h = Math.imul(31, h) + s.charCodeAt(i) | 0;
        return String(h);
    };
    const graphId = simpleHash(sourceCode);
    
    try {
        var savedJson = localStorage.getItem(`cyLayout_${graphId}`);
        if (savedJson) {
            var savedPositions = JSON.parse(savedJson);
            var positionsFound = false;

            graphElements.forEach(el => {
                if (el.classes && el.classes.includes('compound-parent')) {
                    return; 
                }

                if (el.data && el.data.id && savedPositions[el.data.id]) {
                    el.position = savedPositions[el.data.id];
                    positionsFound = true;
                }
            });
            return positionsFound;
        }
    } catch(e) { console.warn("Erro ao ler posições."); }
    return false;
}

function hasExistingLayoutsInLocalStorage() {
    if (typeof localStorage === 'undefined') return false;
    for (let i = 0; i < localStorage.length; i++) {
        if (localStorage.key(i).startsWith('cyLayout_')) return true;
    }
    return false;
}

async function loadDefaultLayoutsFromSeedFile() {
    try {
        const r = await fetch('js/cy/all-cytoscape-layouts-backup.json');
        if (!r.ok) return;
        const layouts = await r.json();
        for (const k in layouts) {
            if (k.startsWith('cyLayout_')) localStorage.setItem(k, JSON.stringify(layouts[k]));
        }
    } catch (e) { console.warn("Layouts padrão não encontrados."); }
}

function autoSaveLayoutToLocalStorage(cy, graphId) {
    if (!cy || !graphId) return;
    const p = {};
    cy.nodes().forEach(node => {
        if (node.isParent()) return;

        if (node.position()) {
            positions[node.id()] = node.position();
        }
    });
    localStorage.setItem(`cyLayout_${graphId}`, JSON.stringify(p));
}

function loadLayoutFromLocalStorage(cy, graphId) {
    const saved = localStorage.getItem(`cyLayout_${graphId}`);
    if (saved) {
        try {
            const p = JSON.parse(saved);
            cy.batch(() => {
                for (const id in p) {
                    const n = cy.getElementById(id);
                    if (n.length > 0) n.position(p[id]);
                }
            });
            cy.fit(null, 50);
        } catch (e) {}
    }
}

function getCytoscapeStyles() {
    return [ 
        { selector: 'node', style: { 'label': 'data(label)', 'text-valign': 'center', 'color': '#c0caf5', 'font-family': 'sans-serif', 'font-weight': 'bold', 'text-outline-width': 2, 'text-outline-color': '#1a1b26' } },
        { selector: 'edge', style: { 'width': 2, 'curve-style': 'bezier', 'line-color': '#565f89', 'target-arrow-color': '#565f89', 'label': 'data(label)', 'color': '#c0caf5', 'text-outline-color': '#1a1b26', 'text-outline-width': 2, 'font-size': '14px' } },
        { selector: 'node.state-node', style: { 'background-color': '#7aa2f7', 'shape': 'ellipse', 'width': 50, 'height': 50, 'border-width': 3, 'border-color': '#414868','text-wrap': 'wrap','text-valign': 'center' } },
        { selector: 'node.has-invariant', style: {'label': (ele) => ele.data('label') + '\n[' + ele.data('invariant') + ']'}},
        { selector: '.current-state', style: { 'background-color': '#9ece6a', 'border-color': '#ffffff', 'border-width': 4 } },
        { selector: 'node.event-node', style: { 'background-color': '#414868', 'shape': 'rectangle', 'width': 50, 'height': 30, 'border-width': 2, 'border-color': '#565f89' } },
        { selector: 'edge', style: { 'target-arrow-shape': 'none' } },
        { selector: 'edge.from-action-node', style: { 'target-arrow-shape': 'triangle' } },
        { selector: '.enable-rule', style: { 'line-color': '#7aa2f7', 'target-arrow-color': '#7aa2f7' } },
        { selector: '.disable-rule', style: { 'line-color': '#f7768e', 'target-arrow-color': '#f7768e' } },
        { selector: 'edge.enable-rule.to-target', style: { 'target-arrow-shape': 'triangle-tee' } },
        { selector: 'edge.disable-rule.to-target', style: { 'target-label': 'X', 'target-text-offset': 5, 'color': '#f7768e','font-size': '12px' } },
        { selector: '.disabled', style: { 'line-style': 'dashed', 'background-opacity': 0.6, 'border-style': 'dashed', 'opacity': 0.7 } },
        { selector: '.transition-flash', style: {'background-color': '#ff9e64','line-color': '#ff9e64', 'target-arrow-color': '#ff9e64'}},
        { selector: '.compound-parent', style: { 'background-color': '#1a1b26', 'background-opacity': 1, 'border-color': '#c0caf5', 'border-width': 2,'content': 'data(label)', 'text-valign': 'top','text-halign': 'center','color': '#c0caf5','font-weight': 'bold','font-size': '16px'} }
    ];
}





function autoSaveLayoutToLocalStorage(cy, graphId) {
    if (!cy || !graphId || typeof localStorage === 'undefined') return;

    const positions = {};
    cy.nodes().forEach(node => {
        positions[node.id()] = node.position();
    });

    const storageKey = `cyLayout_${graphId}`;
    localStorage.setItem(storageKey, JSON.stringify(positions));
}


function loadLayoutFromLocalStorage(cy, graphId) {
    if (!cy || !graphId || typeof localStorage === 'undefined') return false;

    const storageKey = `cyLayout_${graphId}`;
    const savedLayout = localStorage.getItem(storageKey);

    if (savedLayout) {
        try {
            const positions = JSON.parse(savedLayout);
            cy.batch(() => {
                for (const nodeId in positions) {
                    const node = cy.getElementById(nodeId);
                    if (node.length > 0) node.position(positions[nodeId]);
                }
            });
            cy.fit(null, 50);
            console.log(`Layout carregado do LocalStorage para o grafo ${graphId.substring(0, 8)}...`);
            return true;
        } catch (e) {
            console.error("Falha ao carregar layout do LocalStorage:", e);
            localStorage.removeItem(storageKey);
            return false;
        }
    }
    return false;
}


function exportAllLayoutsToFile() {
    if (typeof localStorage === 'undefined') {
        alert("O LocalStorage não é suportado neste navegador.");
        return;
    }

    const allLayouts = {};
    let layoutsFound = 0;

    for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);

        if (key && key.startsWith('cyLayout_')) {

            allLayouts[key] = JSON.parse(localStorage.getItem(key));
            layoutsFound++;
        }
    }

    if (layoutsFound === 0) {
        alert("Nenhum layout salvo foi encontrado para exportar.");
        return;
    }

    const jsonString = JSON.stringify(allLayouts, null, 2);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'all-cytoscape-layouts-backup.json'; 
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(a.href);

    console.log(`${layoutsFound} layouts foram exportados com sucesso.`);
}


function importAllLayoutsFromFile(cy, graphId, jsonString) {
    if (typeof localStorage === 'undefined') {
        alert("O LocalStorage não é suportado neste navegador.");
        return;
    }

    try {
        const allLayouts = JSON.parse(jsonString);
        let layoutsImported = 0;


        for (const key in allLayouts) {
            if (key && key.startsWith('cyLayout_')) {
                const value = JSON.stringify(allLayouts[key]);
                localStorage.setItem(key, value);
                layoutsImported++;
            }
        }

        if (layoutsImported > 0) {
            alert(`${layoutsImported} layouts foram importados com sucesso para o seu navegador!`);
            
            console.log("Tentando aplicar o layout para o grafo atual...");
            loadLayoutFromLocalStorage(cy, graphId);

        } else {
            alert("Nenhum layout válido encontrado no arquivo selecionado.");
        }

    } catch (e) {
        console.error("Falha ao importar layouts do arquivo.", e);
        alert("Erro ao ler o arquivo. Verifique se é um backup de layout válido.");
    }
}
