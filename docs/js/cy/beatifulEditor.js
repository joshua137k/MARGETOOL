
document.addEventListener('click', function(e) {
    var menu = document.getElementById('cy-context-menu');
    if (menu) menu.style.display = 'none';
});

function setupContextMenu(cy) {
    var container = document.getElementById('cytoscapeMainContainer');
    container.oncontextmenu = function(e) {
        e.preventDefault();
        return false;
    };

    cy.on('cxttap', function(event) {
        var menu = document.getElementById('cy-context-menu');
        var list = menu.querySelector('ul');
        list.innerHTML = ''; 

        var target = event.target;
        var isNode = target.isNode && target.isNode();
        var isBackground = target === cy;

        var nativeEvent = event.originalEvent; 
        
        menu.style.left = nativeEvent.clientX + 'px';
        menu.style.top = nativeEvent.clientY + 'px';
        menu.style.display = 'block';

        if (isBackground) {
            addMenuItem(list, '➕ Criar Variável (int)', createVariable);
            addMenuItem(list, '⏰ Criar Clock', createClock);
            addMenuItem(list, '➜ Nova Transição (-->)', function() { createTransition(); }); 
            addMenuItem(list, '🚩 Novo Estado Inicial (init)', createInitState);
        } 
        else if (isNode) {
            var cls = target.classes() || [];
            var data = target.data();

            if (cls.includes('state-node')) {
                addMenuItem(list, '🛡️ Adicionar Invariante (inv)', () => createInvariant(data.label));
            } 
            else if (cls.includes('event-node')) {
                var parts = data.id.split('_');
                if (parts.length >= 4) {
                    var from = parts[1];
                    var to = parts[2];
                    var lbl = parts.slice(3).join('_');
                    
                    addMenuItem(list, '⚡ Criar Ativação (->>)', () => createInteraction(lbl, '->>'));
                    addMenuItem(list, '❌ Criar Negação (--!)', () => createInteraction(lbl, '--!'));
                    addMenuItem(list, '❓ Adicionar Condição (if)', () => addConditionToEdge(from, to, lbl));
                    addMenuItem(list, '📝 Adicionar Update (if ... then)', () => addUpdateToEdge(from, to, lbl));
                }
            }
        }
    });
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


function addUpdateToEdge(from, to, lbl) {
    openSmartModal('Adicionar Update (Efeito)', [
        { 
            label: 'Executar SE (Condição):', 
            placeholder: 'ex: counter < 5', 
            required: true 
        },
        { 
            label: 'ENTÃO faça (Updates):', 
            placeholder: "ex: counter' := counter + 1", 
            required: true 
        }
    ], function(cond, updateCode) {
        var doc = editor.getDoc();
        var lineCount = doc.lineCount();
        var found = false;
        
        var regex = new RegExp(`^\\s*${from}\\s*-->\\s*${to}\\s*:\\s*${lbl}`);

        for (var i = 0; i < lineCount; i++) {
            var lineText = doc.getLine(i);
            
            if (regex.test(lineText)) {
                

                var textToAdd = ` if (${cond}) then { ${updateCode} }`;
                
                var newLine = lineText + textToAdd;
                
                doc.replaceRange(newLine, {line: i, ch: 0}, {line: i, ch: lineText.length});
                found = true;
                break;
            }
        }

        if (found) {
            loadAndRender();
        } else {
            alert("Não encontrei a linha da transição ou ela já foi modificada.");
        }
    });
}


function appendToCode(text) {
    var doc = editor.getDoc();
    var lastLine = doc.lineCount();
    doc.replaceRange("\n" + text, {line: lastLine, ch: 0});
    loadAndRender();
}

function prependToCode(text) {
    var doc = editor.getDoc();
    doc.replaceRange(text + "\n", {line: 0, ch: 0});
    loadAndRender();
}







function getModelSuggestions() {
    var states = new Set();
    var actions = new Set();
    
    if (currentCytoscapeInstance) {
        currentCytoscapeInstance.nodes().forEach(function(ele) {
            var data = ele.data();
            var cls = ele.classes() || [];
            
            if (cls.includes('state-node') && data.label) {
                states.add(data.label);
            }
            if (cls.includes('event-node') && data.label) {
                actions.add(data.label);
            }
        });
    }
    return {
        states: Array.from(states).sort(),
        actions: Array.from(actions).sort()
    };
}

function openSmartModal(title, fields, callback) {
    
    var modalTitle = document.getElementById('quickModalTitle');
    var container = document.getElementById('quickModalInputs');
    var saveBtn = document.getElementById('quickModalSaveBtn');
    
    modalTitle.innerText = title;
    container.innerHTML = '';


    fields.forEach(function(field, index) {
        var group = document.createElement('div');
        group.className = 'form-group';
        
        if (field.label) {
            var lbl = document.createElement('label');
            lbl.style.fontSize = '12px';
            lbl.innerText = field.label;
            group.appendChild(lbl);
        }

        var input = document.createElement('input');
        input.className = 'form-control input-sm';
        input.id = 'modal_input_' + index;
        input.type = field.type || 'text';
        if (field.value) input.value = field.value;
        if (field.placeholder) input.placeholder = field.placeholder;

        if (field.suggestions && field.suggestions.length > 0) {
            var listId = 'list_' + Math.random().toString(36).substr(2, 9);
            input.setAttribute('list', listId);
            
            var datalist = document.createElement('datalist');
            datalist.id = listId;
            
            field.suggestions.forEach(function(opt) {
                var option = document.createElement('option');
                option.value = opt;
                datalist.appendChild(option);
            });
            group.appendChild(datalist);
        }

        group.appendChild(input);
        container.appendChild(group);
    });


    var newBtn = saveBtn.cloneNode(true);
    saveBtn.parentNode.replaceChild(newBtn, saveBtn);
    
    newBtn.addEventListener('click', function() {
        var results = [];
        var isValid = true;
        
        fields.forEach(function(f, i) {
            var val = document.getElementById('modal_input_' + i).value;
            if (!val && f.required) isValid = false;
            results.push(val);
        });

        if (isValid) {
            callback.apply(null, results); 
            $('#quickModal').modal('hide');
        } else {
            alert("Por favor, preencha os campos obrigatórios.");
        }
    });

    $('#quickModal').one('shown.bs.modal', function () {
        document.getElementById('modal_input_0').focus();
    });

    $('#quickModal').appendTo("body").modal('show'); 
}



function createVariable() {
    openSmartModal('Nova Variável', [
        { label: 'Nome da Variável:', placeholder: 'ex: counter', required: true },
        { label: 'Valor Inicial:', type: 'number', value: '0', required: true }
    ], function(name, val) {
        prependToCode(`int ${name} = ${val}`);
    });
}

function createClock() {
    openSmartModal('Novo Clock', [
        { label: 'Nome do Clock:', placeholder: 'ex: c1', required: true }
    ], function(name) {
        prependToCode(`clock ${name};`);
    });
}

function createInitState() {
    openSmartModal('Estado Inicial', [
        { label: 'Nome do Estado:', value: 's0', required: true }
    ], function(name) {
        appendToCode(`init ${name}`);
    });
}

function createTransition() {
    var data = getModelSuggestions();
    
    openSmartModal('Nova Transição', [
        { 
            label: 'De (Origem):', 
            placeholder: 'Selecione ou digite...', 
            required: true,
            suggestions: data.states 
        },
        { 
            label: 'Para (Destino):', 
            placeholder: 'Selecione ou digite...', 
            required: true,
            suggestions: data.states
        },
        { 
            label: 'Nome da Ação (Label):', 
            placeholder: 'ex: a', 
            required: true,
            suggestions: data.actions 
        }
    ], function(source, target, label) {
        appendToCode(`${source} --> ${target}: ${label}`);
    });
}

function createInvariant(state) {
    openSmartModal(`Invariante em '${state}'`, [
        { label: 'Condição:', placeholder: 'ex: x < 10', required: true }
    ], function(cond) {
        appendToCode(`inv ${state}: ${cond};`);
    });
}

function createInteraction(sourceLabel, symbol) {
    var data = getModelSuggestions();
    var typeText = symbol === '->>' ? 'Ativar' : 'Desativar (Negar)';
    
    openSmartModal(`${typeText} ação...`, [
        { 
            label: `'${sourceLabel}' vai ${typeText.toLowerCase()}:`, 
            placeholder: 'Selecione a ação alvo...', 
            required: true,
            suggestions: data.actions 
        }
    ], function(targetLabel) {
        appendToCode(`${sourceLabel} ${symbol} ${targetLabel}`);
    });
}

function addConditionToEdge(from, to, lbl) {
    openSmartModal('Adicionar Condição (Guard)', [
        { label: 'Expressão:', placeholder: 'ex: counter > 0', required: true }
    ], function(cond) {
        var doc = editor.getDoc();
        var lineCount = doc.lineCount();
        var found = false;
        var regex = new RegExp(`^\\s*${from}\\s*-->\\s*${to}\\s*:\\s*${lbl}`);

        for (var i = 0; i < lineCount; i++) {
            var lineText = doc.getLine(i);
            if (regex.test(lineText)) {
                var newLine = "";
                if (lineText.includes(" if ")) {
                    newLine = lineText + ` AND (${cond})`;
                } else {
                    newLine = lineText + ` if (${cond})`;
                }
                doc.replaceRange(newLine, {line: i, ch: 0}, {line: i, ch: lineText.length});
                found = true;
                break;
            }
        }
        if (found) loadAndRender();
        else alert("Não consegui achar a linha. O código pode estar formatado de forma diferente.");
    });
}