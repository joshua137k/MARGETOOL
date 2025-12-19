

function loadExample() {
    var select = document.getElementById("examplesSelect");
    var code = select.value;
    if (code) {
        editor.setValue(code);
    }
}

function runPdl() {
    var s = document.getElementById("pdlState").value;
    var visualFormula = document.getElementById("pdlFormula").value;
    

    var protectedCode = visualFormula
        .replace(/⟨/g, '___DIAM_OPEN___')
        .replace(/⟩/g, '___DIAM_CLOSE___')
        .replace(/¬/g, '!')
        .replace(/∧/g, '&&')
        .replace(/∨/g, '||')
        .replace(/→/g, '->')
        .replace(/↔/g, '<->')
        .replace(/⊤/g, 'true')
        .replace(/⊥/g, 'false');


    
    var regexComparison = /\b([a-zA-Z_][\w\.]*)\s*(=|==|≠|!=|≤|<=|≥|>=|<|>)\s*(-?\d+(?:\.\d+)?|[a-zA-Z_][\w\.]*)\b/g;

    var codeWithVars = protectedCode.replace(regexComparison, function(match, v1, op, v2) {
        
        if (['true', 'false', '___DIAM_OPEN___', '___DIAM_CLOSE___'].includes(v1)) return match;

        var backendOp = op;
        if (op === '=' || op === '==') backendOp = '==';
        if (op === '≠' || op === '!=') backendOp = '!=';
        if (op === '≤' || op === '<=') backendOp = '<=';
        if (op === '≥' || op === '>=') backendOp = '>=';
        
        return '[' + v1 + ' ' + backendOp + ' ' + v2 + ']';
    });


    var finalCode = codeWithVars
        .replace(/___DIAM_OPEN___/g, '<')
        .replace(/___DIAM_CLOSE___/g, '>');

    console.log("Fórmula Original:", visualFormula);
    console.log("Enviando Backend:", finalCode); 

    var res = RTA.runPdl(s, finalCode);
    
    var resDiv = document.getElementById("pdlResult");
    resDiv.innerText = res;
    
    if (res.includes("true") || res.includes("Result: true")) {
        resDiv.style.color = "green";
        resDiv.innerHTML = '<span class="glyphicon glyphicon-ok"></span> Verdadeiro';
    } else if (res.includes("false") || res.includes("Result: false")) {
        resDiv.style.color = "red";
        resDiv.innerHTML = '<span class="glyphicon glyphicon-remove"></span> Falso';
    } else {
        resDiv.style.color = "#e0e0e0ff";
    }
}

function loadAndRender() {
    var code = editor.getValue();
    var jsonString = RTA.loadModel(code);
    var data = JSON.parse(jsonString);
    
    if (data.error) {
        alert(data.error);
    } else {
        textTraceHistory = [];
        jsTextHistory = [];
        var initialStateText = RTA.getCurrentStateText(); 
        jsTextHistory.push({ label: "Start ->", text: initialStateText });
        renderCytoscapeGraph("cytoscapeMainContainer", data, true);
        
        updateAllViews(jsonString);
        console.log(data);
        renderPdlHelpers(data);
    }
}


function addMenuItem(list, text, onClick) {
    var li = document.createElement('li');
    var a = document.createElement('a');
    a.href = "#";
    a.innerText = text;
    a.onclick = function(e) {
        e.preventDefault();
        document.getElementById('cy-context-menu').style.display = 'none';
        onClick();
    };
    li.appendChild(a);
    list.appendChild(li);
}



function translateToGLTS() {
    var newCode = RTA.translateToGLTS();
    if (newCode && !newCode.startsWith("Erro")) {
        editor.setValue(newCode);
        loadAndRender();
        alert("Traduzido com sucesso!");
    } else {
        alert(newCode);
    }
}

function renderPdlHelpers(data) {
    var statesDiv = document.getElementById('pdl-states-list');
    var actionsDiv = document.getElementById('pdl-actions-list');
    var varsDiv = document.getElementById('pdl-vars-list'); 
    
    if (!statesDiv || !actionsDiv || !data || !data.graphElements) return;

    statesDiv.innerHTML = '';
    actionsDiv.innerHTML = '';
    if (varsDiv) varsDiv.innerHTML = '';

    var uniqueStates = new Set();
    var uniqueActions = new Set();

    data.graphElements.forEach(function(el) {
        var cls = el.classes || "";
        if (cls.indexOf('state-node') !== -1 && el.data && el.data.label) uniqueStates.add(el.data.label);
        if (cls.indexOf('event-node') !== -1 && el.data && el.data.label) uniqueActions.add(el.data.label);
    });

    if (uniqueStates.size === 0) statesDiv.innerHTML = '<span class="text-muted" style="font-size:10px;">Nada.</span>';
    Array.from(uniqueStates).sort().forEach(function(st) {
        var btn = document.createElement('button');
        btn.className = 'btn btn-xs btn-primary';
        btn.style.margin = '2px';
        btn.innerText = st;
        btn.onclick = function() { setState(st); };
        statesDiv.appendChild(btn);
    });

    var hasVars = false;
    if (data.panelData) {
        var allVars = {};
        if (data.panelData.variables) Object.assign(allVars, data.panelData.variables);
        if (data.panelData.clocks) Object.assign(allVars, data.panelData.clocks);

        for (var vName in allVars) {
            hasVars = true;
            var btn = document.createElement('button');
            btn.className = 'btn btn-xs btn-success';
            btn.style.margin = '2px';
            btn.innerText = vName;
            btn.onclick = (function(name){ return function() { insertPdl(name); }; })(vName);
            if (varsDiv) varsDiv.appendChild(btn);
        }
    }
    if (!hasVars && varsDiv) varsDiv.innerHTML = '<span class="text-muted" style="font-size:10px;">Nenhuma variável.</span>';


    var hasContent = false;
    if (uniqueActions.size > 0) {
        Array.from(uniqueActions).sort().forEach(function(act) {
            var btn = document.createElement('button');
            btn.className = 'btn btn-xs btn-warning';
            btn.style.margin = '2px';
            btn.innerText = act;
            btn.onclick = function() { insertPdl(act); };
            actionsDiv.appendChild(btn);
        });
        hasContent = true;
    }
    
    if (uniqueStates.size > 0) {
        if (hasContent) {
            var divider = document.createElement('span');
            divider.style.borderLeft = "1px solid #ccc";
            divider.style.margin = "0 5px";
            actionsDiv.appendChild(divider);
        }
        Array.from(uniqueStates).sort().forEach(function(st) {
            var btn = document.createElement('button');
            btn.className = 'btn btn-xs btn-primary';
            btn.style.margin = '2px';
            btn.innerText = st;
            btn.onclick = function() { insertPdl(st); };
            actionsDiv.appendChild(btn);
        });
        hasContent = true;
    }
    if (!hasContent) actionsDiv.innerHTML = '<span class="text-muted" style="font-size:10px;">Nada.</span>';
}

function setState(val) {
    var input = document.getElementById('pdlState');
    input.value = val;
    input.style.backgroundColor = "#d1e7dd"; 
    setTimeout(() => input.style.backgroundColor = "#fff", 300);
}

function insertPdl(text, suffix) {
    var input = document.getElementById('pdlFormula');
    var valToInsert = text + (suffix || "");
    
    if (input.selectionStart || input.selectionStart == '0') {
        var startPos = input.selectionStart;
        var endPos = input.selectionEnd;
        input.value = input.value.substring(0, startPos) + valToInsert + input.value.substring(endPos, input.value.length);
        
        if (suffix) {
             input.selectionStart = startPos + text.length;
             input.selectionEnd = startPos + text.length;
        } else {
             input.selectionStart = startPos + valToInsert.length;
             input.selectionEnd = startPos + valToInsert.length;
        }
    } else {
        input.value += valToInsert;
    }
    input.focus();
}


