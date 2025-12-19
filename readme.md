# RTA Tool (Reconfigurable Timed Automata: Animated Analysis)

RTA is a formal verification and animation tool for Labelled Reactive Graphs. It was developed at the Department of Mathematics, University of Aveiro, with the support of FCT (Foundation for Science and Technology).
The tool allows users to model reactive systems, simulate transitions step-by-step, verify properties using PDL (Propositional Dynamic Logic), and export models to Uppaal and mCRL2.

🔗 **Live Demo:** [https://joshua137k.github.io/RTATOOL/](https://joshua137k.github.io/RTATOOL/)

---

## 📋 Features

*   **Visual Editor:** Write Reactive Graph syntax with syntax highlighting.
*   **Interactive Simulation:** Click on nodes/transitions to step through the system.
*   **Time Travel:** Undo/Redo support for simulation steps.
*   **State Space Visualization:** View the current state or the full LTS (Labelled Transition System) using Mermaid or Cytoscape.
*   **PDL Verification:** Verify properties like `[a;b]s0` or `<act>true` directly in the tool.
*   **Exports:** Convert your models to **Uppaal** (RG, GLTS, TGRG) and **mCRL2**.
*   **Hybrid Architecture:** Runs entirely in the browser (Scala.js) or as a standalone Desktop App/CLI (JVM).

---

## 🛠 Prerequisites

To build and run this project from source, you need:

1.  **JDK 17** (Required).
2.  **SBT** (Scala Build Tool).

---

## 🚀 Building the Project

Start the SBT console (ensure you are using Java 17):

```bash
# Example for Windows Powershell
sbt -java-home "C:\Program Files\Java\jdk-17" -mem 4096
```

### 1. Building the Web Version (Frontend)

To generate the JavaScript code that powers the HTML interface:

```bash
# Inside sbt console:
rtaJS/fastLinkJS
```

*   **Output:** The compiled JavaScript will be placed in `docs/js/gen/main.js`.
*   **Run:** Open `docs/index.html` in your browser.

### 2. Building the Desktop App & CLI (Backend)

To create the standalone executable JAR file (which includes the web server and the CLI tools):

```bash
# Inside sbt console:
rtaJVM/assembly
```

*   **Output:** `jvm/target/scala-3.3.1/rtaTool.jar`

---

## 🖥️ Usage

### 1. Desktop GUI Mode
Simply run the generated JAR without arguments. This will start an internal web server and open your default browser with the full interface (offline).

```bash
java -jar rtaTool.jar
```

### 2. Command Line Interface (CLI)
You can use the JAR to perform batch conversions, verifications, and analysis without opening the GUI.

**Syntax:** `java -jar rtaTool.jar [COMMAND] [OPTIONS] <INPUT_FILE>`

#### Available Commands:

| Command | Description | Example |
| :--- | :--- | :--- |
| **-text** | Prints the textual representation of the initial state. | `java -jar rtaTool.jar -text model.txt` |
| **-mermaid** | Prints the Mermaid diagram code for the initial state. | `java -jar rtaTool.jar -mermaid model.txt` |
| **-step** | Lists currently enabled transitions and delays. | `java -jar rtaTool.jar -step model.txt` |
| **-lts** | Generates the full LTS (State Space) in Mermaid format. | `java -jar rtaTool.jar -lts model.txt > output.mermaid` |
| **-pdl** | Verifies a PDL formula against the model. | `java -jar rtaTool.jar -pdl "s0" "[a]false" model.txt` |
| **-translate** | Translates the code to GLTS syntax. | `java -jar rtaTool.jar -translate out.txt in.txt` |
| **-uppaalRG** | Exports to Uppaal XML (Reactive Graph). | `java -jar rtaTool.jar -uppaalRG out.xml in.txt` |
| **-uppaalGLTS** | Exports to Uppaal XML (GLTS). | `java -jar rtaTool.jar -uppaalGLTS out.xml in.txt` |
| **-uppaalGRG** | Exports to Uppaal XML (TGRG). | `java -jar rtaTool.jar -uppaalGRG out.xml in.txt` |

---

## 📂 Project Structure

*   `shared/` - Core logic (Parser, Semantics, Converters) shared between JS and JVM.
*   `js/` - Frontend logic (Cytoscape integration, DOM manipulation, rtaAPI).
*   `jvm/` - Desktop logic (CLI, Embedded HTTP Server).
*   `docs/` - Static files for the web interface (HTML, CSS, Libs).

---

## 📝 Example Model

```rta
init s0
s0 --> s1: a
s1 --> s0: b
a --! a: offA disabled
```
```