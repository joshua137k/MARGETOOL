### **Evolução do Projeto RTA: Da Animação de Grafos Reativos a uma Plataforma Integrada de Modelação e Verificação Formal**

O trabalho aqui apresentado foi desenvolvido no Departamento de Matemática da Universidade de Aveiro, com o apoio da FCT, e representa uma expansão significativa dos objetivos inicialmente definidos no plano de trabalho do projeto RTA. A proposta original de integrar um interpretador de lógica modal foi não apenas cumprida, como amplamente superada, transformando o RTA de uma simples ferramenta de animação num ambiente robusto para a modelação, simulação e verificação formal de sistemas reconfiguráveis complexos.

As contribuições podem ser organizadas em três eixos fundamentais: a extensão do formalismo base, a introdução de capacidades avançadas de verificação formal e o estabelecimento de mapeamentos formais para outros sistemas de modelação.

### **1. Extensão do Formalismo de Grafos Reativos**

O poder expressivo do modelo de **Grafos Reativos (RG)** foi ampliado com a introdução de conceitos de **guardas** e **tempo**, dando origem a dois novos formalismos mais ricos.

* **Grafos Reativos Guardados (GRG – Guarded Reactive Graphs):** O formalismo foi estendido para incluir **variáveis de estado** e **guardas** sobre as transições. Neste modelo, a ativação de uma transição depende não só da estrutura do grafo, mas também da satisfação de condições lógicas sobre o estado atual das variáveis. As transições podem ainda induzir **atualizações atómicas** nessas variáveis, permitindo modelar sistemas cujo comportamento é guiado por dados, e não apenas por eventos. Esta extensão é essencial para representar de forma fiel protocolos e sistemas de software complexos.

* **Grafos Reativos Temporizados (Timed Reactive Graphs):** Foi introduzida uma semântica de **tempo contínuo**, inspirada no formalismo dos **Autómatos Temporizados**. Os estados podem conter **invariantes temporais** (condições que devem permanecer verdadeiras enquanto o sistema se encontra nesse estado), e as guardas das transições podem incluir **restrições temporais** baseadas em relógios. Esta extensão permite ao RTA modelar e analisar **sistemas de tempo real** e **protocolos de comunicação sensíveis ao tempo**.

### **2. Análise Formal e Verificação de Propriedades**

O objetivo de análise formal foi alcançado com a implementação de um verificador baseado na **Lógica Proposicional Dinâmica (PDL)**, uma lógica modal mais expressiva do que as lógicas modais tradicionais.

Em vez de verificar apenas propriedades estáticas, o verificador PDL permite especificar e analisar propriedades sobre **sequências de execução** (programas). Assim, é possível formular e responder a questões como:

* “É possível, através da execução da sequência de ações `α`, alcançar um estado onde a propriedade `φ` é verdadeira?” (representado por `<α>φ`)
* “Após qualquer execução da sequência de ações `α`, o estado resultante satisfaz necessariamente a propriedade `φ`?” (representado por `[α]φ`)

Esta capacidade acrescenta uma dimensão dinâmica à análise, permitindo a verificação de **alcançabilidade**, **segurança** e **vivacidade** diretamente sobre os modelos. Atualmente, o verificador PDL atua sobre a estrutura lógica e de dados do grafo, ainda sem considerar as restrições temporais.



### **3. Nova Infraestrutura Tecnológica e de Simulação**

#### **1. Arquitetura Híbrida e Independência (JS/JVM)**
O núcleo do sistema foi reestruturado, utilizando uma base de código partilhada que suporta dois alvos de compilação distintos através de uma abordagem "build once, run anywhere":
*   **Frontend (Scala.js):** Compilação para JavaScript, gerando uma aplicação Web reativa onde toda a lógica semântica e de simulação é executada no cliente (browser), sem necessidade de servidor.
*   **Backend/Desktop (JVM):** Compilação para um **ficheiro JAR executável**. Este modo inclui um servidor HTTP interno para disponibilizar a interface offline e uma **Interface de Linha de Comandos (CLI)** robusta para automação.
Esta autonomia permitiu o desenvolvimento de um motor semântico próprio e otimizado, garantindo controlo total sobre a gestão de estados e a performance da ferramenta.

#### **2. Simulação Interativa e Dinâmica (Cytoscape.js)**
A visualização evoluiu de uma natureza estática (baseada em diagramas sequenciais Mermaid) para um **ambiente de simulação interativo** baseado na biblioteca **Cytoscape.js**. Esta transição resolveu limitações críticas do animador original:
*   **Representação Dinâmica:** O grafo é agora um objeto persistente e manipulável em tempo real. O utilizador pode interagir com os elementos, permitindo um feedback visual instantâneo durante a simulação.
*   **Animação Semântica:** Durante a execução passo-a-passo, as transições, estados ativos e atualizações de variáveis são destacados dinamicamente. Esta abordagem visual facilita a depuração e a compreensão intuitiva do comportamento de modelos complexos (como os GRG e os temporizados).

#### **3. Interoperabilidade e Automação via CLI**
Para lá da exploração visual, o RTA foi desenhado para se integrar em fluxos de trabalho de verificação formal estabelecidos:
*   **Conversores Formais:** Implementação de geradores de código que permitem a exportação automática para ferramentas de referência como **UPPAAL (XML)** e **mCRL2**, possibilitando a validação dos modelos através de motores de *model checking* exaustivos.
*   **Processamento em Lote:** Através da CLI no ficheiro JAR, o sistema suporta tarefas automatizadas sem interface gráfica, tais como a verificação em massa de fórmulas **PDL**, a geração do espaço de estados total (**LTS**) e a tradução entre formalismos (ex: de Grafos Reativos para GLTS).





### **4. Mapeamentos Formais e Interoperabilidade**

Para validar os formalismos e potenciar a sua análise com ferramentas externas, foram desenvolvidos **tradutores formais** que estabelecem um mapeamento semântico entre os Grafos Reativos e outros modelos computacionais consolidados.

* **Tradução de RG/GRG para GLTS (Guarded Labeled Transition Systems):** Foi criado um procedimento de compilação que traduz a semântica de reconfiguração dos Grafos Reativos (baseada em hiper-arestas) para um **Sistema de Transição Rotulado e Guardado (GLTS)** equivalente. Nesta tradução, o comportamento dinâmico dos RG é representado através de variáveis de controlo e guardas complexas, demonstrando formalmente como a reconfiguração pode ser simulada num formalismo mais tradicional.

* **Tradução para o Formalismo de UPPAAL:** Um dos avanços mais relevantes foi a capacidade de exportar modelos, incluindo os **Grafos Reativos Temporizados**, para o formato **XML do UPPAAL**, uma das ferramentas mais reconhecidas na verificação de sistemas de tempo real. Esta tradução não é meramente sintática; constitui uma **ponte formal** que permite submeter os modelos criados no RTA aos algoritmos de *model checking* do UPPAAL para análise exaustiva e automática.

Complementarmente, a interface do RTA foi redesenhada para facilitar a exploração visual e intuitiva de modelos complexos. A nova interface permite **simulação passo-a-passo**, **animação de transições** e **inspeção em tempo real** das variáveis e relógios, tornando-se uma ferramenta essencial para a depuração e para a compreensão do comportamento dos sistemas modelados.
