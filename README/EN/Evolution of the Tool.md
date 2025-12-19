### **Evolution of the RTA Project: From Reactive Graph Animation to an Integrated Platform for Modeling and Formal Verification**

This work was developed at the Department of Mathematics of the University of Aveiro, supported by the FCT, and represents a significant expansion of the objectives originally defined in the RTA project plan. The initial proposal to integrate a modal logic interpreter was not only achieved but also greatly surpassed, transforming RTA from a simple animation tool into a robust environment for modeling, simulation, and formal verification of complex reconfigurable systems.

The contributions can be organized into three main areas: the extension of the core formalism, the introduction of advanced formal verification capabilities, and the establishment of formal mappings to other modeling systems.

### **1. Extension of the Reactive Graph Formalism**

The expressive power of the **Reactive Graph (RG)** model was expanded with the introduction of **state** and **time** concepts, leading to two new, more expressive formalisms.

* **Guarded Reactive Graphs (GRG):** The formalism was extended to include **state variables** and **guards** on transitions. In this model, the activation of a transition depends not only on the graph’s structural configuration but also on logical conditions over the current state of the variables. Transitions can also induce **atomic updates** to these variables, enabling the modeling of systems whose behavior depends on data as well as events. This extension is essential for faithfully representing complex software systems and protocols.

* **Timed Reactive Graphs (TRG):** A continuous-time semantics was introduced, inspired by the formalism of **Timed Automata**. States can include **temporal invariants** (conditions that must remain true while the system stays in that state), and transition guards can include **time constraints** based on clocks. This extension enables RTA to model and analyze **real-time systems** and **time-sensitive communication protocols**.

### **2. Formal Analysis and Property Verification**

The goal of formal analysis was achieved through the implementation of a verifier based on **Propositional Dynamic Logic (PDL)**, a modal logic that is more expressive than standard modal logics.

Rather than checking only static properties of states, the PDL verifier allows for the specification and verification of properties over **execution sequences** (programs). It is thus possible to formulate and answer questions such as:

* “Is it possible, through the execution of an action sequence `α`, to reach a state where the property `φ` holds?” (represented as `<α>φ`)
* “After any execution of the action sequence `α`, does the resulting state necessarily satisfy the property `φ`?” (represented as `[α]φ`)

This capability adds a dynamic dimension to analysis, allowing the verification of **reachability**, **safety**, and **liveness** properties directly on the models. Currently, the PDL verifier operates on the logical and data structure of the graph, not yet incorporating temporal constraints.

### **3. New Technological and Simulation Infrastructure**

#### **1. Hybrid Architecture and Independence (JS/JVM)**
The system’s core was restructured using a shared codebase that supports two distinct compilation targets through a "build once, run anywhere" approach:
*   **Frontend (Scala.js):** Compiles to JavaScript, generating a reactive web application where all semantic logic and simulation are executed on the client side (browser), requiring no external server.
*   **Backend/Desktop (JVM):** Compiles into a **standalone executable JAR file**. This mode includes an internal HTTP server to provide the interface offline and a robust **Command Line Interface (CLI)** for automation.
This autonomy allowed for the development of a custom, optimized semantic engine, ensuring total control over state management and tool performance.

#### **2. Interactive and Dynamic Simulation (Cytoscape.js)**
The visualization layer evolved from a static nature (previously based on Mermaid sequence diagrams) to an **interactive simulation environment** powered by the **Cytoscape.js** library. This transition resolved critical limitations of the original animator:
*   **Dynamic Representation:** The graph is now a persistent object that can be manipulated in real-time. Users can interact directly with elements, providing instantaneous visual feedback during simulation.
*   **Semantic Animation:** During step-by-step execution, transitions, active states, and variable updates are highlighted dynamically. This visual approach facilitates debugging and provides an intuitive understanding of complex models (such as Guarded and Timed Reactive Graphs).

#### **3. Interoperability and CLI Automation**
Beyond visual exploration, the RTA tool was designed to integrate seamlessly into established formal verification workflows:
*   **Formal Converters:** Implementation of code generators that allow for automatic export to industry-standard tools such as **UPPAAL (XML)** and **mCRL2**, enabling model validation through exhaustive model-checking engines.
*   **Batch Processing:** Through the CLI in the executable JAR, the system supports automated tasks without a graphical interface, such as mass **PDL formula verification**, full state-space (**LTS**) generation, and translation between formalisms (e.g., from Reactive Graphs to GLTS).



### **4. Formal Mappings and Interoperability**

To validate the formalisms and enable their analysis using external tools, **formal translators** were developed to establish semantic mappings between Reactive Graphs and other well-established computational models.

* **Translation from RG/GRG to GLTS (Guarded Labeled Transition Systems):** A compilation procedure was created that translates the reconfiguration semantics of Reactive Graphs (based on hyperedges) into an equivalent **Guarded Labeled Transition System (GLTS)**. In this translation, the dynamic behavior of RGs is encoded through control variables and complex guards, formally demonstrating how reconfiguration can be simulated in a more traditional framework.

* **Translation to the UPPAAL Formalism:** One of the most significant developments is the ability to export models—including **Timed Reactive Graphs**—to **UPPAAL’s XML format**, one of the most recognized tools for real-time system verification. This translation is not merely syntactic; it forms a **formal bridge** that allows RTA models to be analyzed using UPPAAL’s powerful model-checking algorithms for exhaustive and automatic analysis.

Additionally, the RTA interface was redesigned to support intuitive exploration of complex models. The new interface enables **step-by-step simulation**, **transition animation**, and **real-time inspection** of variable and clock states, making it an indispensable tool for debugging and for building intuition about system behavior.

---

In summary, the RTA project has evolved from a simple graph animator into a **comprehensive environment for modeling and formal verification**, capable of representing, simulating, and analyzing reconfigurable, guarded, and timed systems—establishing itself as an essential tool for research and education in reactive and timed systems.
