package rta.frontend

import scala.scalajs.js
import scala.scalajs.js.annotation.{JSExport, JSExportTopLevel}
import rta.syntax.Parser2
import rta.syntax.Program2.{RxGraph, Edge, QName}
import rta.backend.{RxSemantics, CytoscapeConverter, PdlEvaluator, MCRL2, UppaalConverter, UppaalConverter2, UppaalConverter3, AnalyseLTS}
import rta.syntax.PdlParser
import rta.syntax.RTATranslator
import rta.syntax.Condition

@JSExportTopLevel("RTA")
object RTAAPI {

  private var currentGraph: Option[RxGraph] = None
  private var currentSource: String = ""
  private var history: List[RxGraph] = Nil

  private def escapeJson(str: String): String = {
    if (str == null) "" else str
      .replace("\\", "\\\\")
      .replace("\"", "\\\"")
      .replace("\n", "\\n")
      .replace("\r", "")
      .replace("\t", "\\t")
  }

  @JSExport
  def getAllStepsMermaid(): String = {
    currentGraph.map { root =>
      var visited = Set[RxGraph](root)
      var queue = List(root)
      var transitionsStr = List[String]()
      

      var stateToId = Map[RxGraph, Int](root -> 0)
      var idCounter = 0
      
      def getId(g: RxGraph): Int = {
        if (stateToId.contains(g)) stateToId(g)
        else {
          idCounter += 1
          stateToId += (g -> idCounter)
          idCounter
        }
      }

      val maxStates = 1000 

      while(queue.nonEmpty && visited.size < maxStates) {
        val current = queue.head
        queue = queue.tail
        val sourceId = getId(current)
        
        val nexts = RxSemantics.nextEdge(current)
        
        for ((edge, nextState) <- nexts) {
          val targetId = getId(nextState)
          val label = edge._3.show 
          
          transitionsStr = s"$sourceId -->|\"$label\"| $targetId" :: transitionsStr
          
          if (!visited.contains(nextState)) {
            visited += nextState
            queue = queue :+ nextState
          }
        }
      }
       
      val nodeDefinitions = stateToId.map { case (state, id) =>
        val label = state.inits.mkString(", ")
        val style = if (state == root) "style " + id + " fill:#9ece6a,stroke:#333,stroke-width:2px" else ""
        s"$id(\"$label\")\n$style"
      }.mkString("\n")

      s"""graph LR
         |${transitionsStr.reverse.mkString("\n")}
         |$nodeDefinitions
         |""".stripMargin
      
    }.getOrElse("graph LR\n0(Nenhum modelo carregado)")
  }

  @JSExport
  def loadModel(sourceCode: String): String = {
    try {
      currentSource = sourceCode
      val graph = Parser2.parseProgram(sourceCode)
      currentGraph = Some(graph)
      history = List(graph)
      generateSimulationJson(graph, None)
    } catch {
      case e: Throwable =>
        s"""{"error": "${escapeJson("Erro ao fazer o parse: " + e.getMessage)}"}"""
    }
  }

  @JSExport
  def takeStep(edgeJson: String): String = {
    currentGraph match {
      case Some(graph) =>
        try {
          val edgeData = js.JSON.parse(edgeJson)
          val from = stringToQName(edgeData.selectDynamic("from").toString)
          val to = stringToQName(edgeData.selectDynamic("to").toString)
          val lbl = stringToQName(edgeData.selectDynamic("lbl").toString)
          val clickedEdge: Edge = (from, to, lbl)

          RxSemantics.nextEdge(graph).find(_._1 == clickedEdge) match {
            case Some((_, nextGraph)) =>
              history = nextGraph :: history
              currentGraph = Some(nextGraph)
              generateSimulationJson(nextGraph, Some(clickedEdge))
            case None => s"""{"error": "Transição inválida."}"""
          }
        } catch {
          case e: Throwable => s"""{"error": "${escapeJson(e.getMessage)}"}"""
        }
      case None => """{"error": "Nenhum modelo carregado."}"""
    }
  }

  @JSExport
  def undo(): String = {
    if (history.size > 1) {
      history = history.tail
      currentGraph = history.headOption
      generateSimulationJson(currentGraph.get, None)
    } else {
      currentGraph.map(g => generateSimulationJson(g, None)).getOrElse("{}")
    }
  }

  @JSExport
  def advanceTime(delayAmount: Double): String = {
    currentGraph match {
      case Some(currentState) =>
        if (currentState.clocks.isEmpty || delayAmount <= 0) {
          generateSimulationJson(currentState, None)
        } else {
          val delayedClockEnv = currentState.clock_env.map { case (c, v) => (c, v + delayAmount) }
          val potentialNextState = currentState.copy(clock_env = delayedClockEnv)

          val allInvariantsHold = potentialNextState.inits.forall { s =>
            potentialNextState.invariants.get(s) match {
              case Some(inv) => Condition.evaluate(inv, potentialNextState.val_env, potentialNextState.clock_env)
              case None => true
            }
          }

          if (allInvariantsHold) {
            history = potentialNextState :: history
            currentGraph = Some(potentialNextState)
            generateSimulationJson(potentialNextState, None)
          } else {
            generateSimulationJson(currentState, None)
          }
        }
      case None => "{}"
    }
  }


  @JSExport
  def getMcrl2(): String = currentGraph.map(g => MCRL2(g)).getOrElse("Modelo vazio")

  @JSExport
  def translateToGLTS(): String = {
    currentGraph match {
      case Some(g) => RTATranslator.translate_syntax(g, currentSource)
      case None => "Erro: Carregue um modelo primeiro."
    }
  }

  @JSExport
  def getUppaalGLTS(): String = currentGraph.map(g => UppaalConverter2.convert(g, currentSource)).getOrElse("")
  
  @JSExport
  def getUppaalRG(): String = currentGraph.map(g => UppaalConverter.convert(g, currentSource)).getOrElse("")
  
  @JSExport
  def getUppaalTGRG(): String = currentGraph.map(g => UppaalConverter3.convert(g, currentSource)).getOrElse("")

  @JSExport
  def checkProblems(): String = {
    currentGraph.map { g =>
      AnalyseLTS.randomWalk(g)._4 match {
        case Nil => "Nenhum problema encontrado."
        case m => m.mkString("\n")
      }
    }.getOrElse("Modelo vazio")
  }

  @JSExport
  def getStats(): String = {
    currentGraph.map { root =>
      var visited = Set[RxGraph]()
      var toVisit = List(root)
      var edgesCount = 0
      val limit = 2000
      
      while(toVisit.nonEmpty && visited.size < limit) {
        val current = toVisit.head
        toVisit = toVisit.tail
        if (!visited.contains(current)) {
           visited += current
           val nexts = RxSemantics.nextEdge(current).map(_._2)
           edgesCount += nexts.size
           toVisit = toVisit ++ nexts.toList
        }
      }
      val msg = if (visited.size >= limit) s" (parou após $limit estados)" else ""
      s"""== Estatísticas ==\nEstados: ${visited.size}$msg\nTransições: $edgesCount"""
    }.getOrElse("Modelo vazio")
  }

  @JSExport
  def runPdl(stateStr: String, formulaStr: String): String = {
    currentGraph match {
      case Some(rx) =>
        try {
          val adaptedState = stateStr.replace('/', '.')
          Parser2.pp[QName](Parser2.qname, adaptedState) match {
            case Left(err) => s"Error parsing state '$stateStr': $err"
            case Right(startState) =>
              if (!rx.states.contains(startState)) {
                 s"State '${startState.show}' not found in the current model."
              } else {
                 val formula = PdlParser.parsePdlFormula(formulaStr)
                 println(formula)
                 val result = PdlEvaluator.evaluateFormula(startState, formula, rx)
                 s"Result: $result"
              }
          }
        } catch {
          case e: Throwable => 
            val msg = if (e.getMessage != null) e.getMessage else e.toString
            s"Evaluation Error: $msg"
        }
      case None => "Model not loaded."
    }
  }

    @JSExport
  def getExamples(): String = {
    val examples = List(
      "Simple" ->
    """init s0
      |s0 --> s1: a
      |s1 --> s0: b
      |a  --! a: offA""".stripMargin,

  "Conditions" ->
    """int counter = 0
      |init start
      |start --> middle: step1  if (counter < 2) then {
      |  counter' := counter + 1
      |}
      |middle --> endN: activateStep2 if (counter == 1)""".stripMargin,
  
  "GRG" ->
   """int a_active   = 1
      |int b_active   = 0
      |int c_active = 0
      |
      |init s0
      |
      |s0 --> s1: aa  if (a_active == 1) then {
      |  b_active' := 1;
      |  if (c_active == 1) then {
      |  	a_active' := 0
      |  }
      |}
      |
      |s1 --> s0: bb  if (b_active == 1) then {
      |  c_active' := 1;
      |  if (a_active == 0) then {
      |  	b_active' := 0
      |  }
      |}
      |
      |s1 --> s2: cc  if (c_active == 1)
      |
      |
      |aa --! aa: offA2 disabled
      |aa ->> bb: onB if (b_active == 0)
      |bb ->> offA2: onOffA if (c_active == 0)
      |""".stripMargin,
  "TIMER" ->
  """clock t;
    |init s0;
    |inv s1: t <= 10;
    |int c = 0
    |s0 --> s1: start if(c==0) then {
    |  t' := 0;
    |}
    |
    |
    |s1 --> s2: timeout if (t >= 10)
    |
    |s1 --> s0: escape if (t < 5)
    |""".stripMargin,

  "Counter" ->
    """init s0
      |s0 --> s0: act
      |act --! act: offAct disabled
      |act ->> offAct: on1 disabled
      |act ->> on1""".stripMargin,

  "Penguim" ->
    """init Son_of_Tweetie
      |Son_of_Tweetie --> Special_Penguin
      |Special_Penguin --> Penguin: Penguim
      |Penguin --> Bird: Bird
      |Bird --> Does_Fly: Fly
      |
      |Bird --! Fly: noFly
      |Penguim --! noFly""".stripMargin,

  "Vending (max eur1)" ->
    """init Insert
      |Insert --> Coffee: ct50
      |Insert --> Chocolate: eur1
      |Coffee --> Insert: GetCoffee
      |Chocolate --> Insert: GetChoc
      |
      |eur1 --! ct50
      |eur1 --! eur1
      |ct50 --! ct50: lastct50 disabled
      |ct50 --! eur1
      |ct50 ->> lastct50""".stripMargin,

  "Vending (max 3prod)" ->
    """init pay
      |pay --> select: insertCoin
      |select --> soda: askSoda
      |select --> beer: askBeer
      |soda --> pay: getSoda
      |beer --> pay: getBeer
      |
      |askSoda --! askSoda: noSoda disabled
      |askBeer --! askBeer: noBeer
      |askSoda ->> noSoda""".stripMargin,

  "Intrusive product" ->
    """aut s {
      |  init i0
      |  i0 --> i1: a
      |  i1 --> i2: b
      |  i2 --> i0: d disabled
      |  a --! b
      |}
      |aut w {
      |  init i0
      |  i0 --> i1: a
      |  i1 --> i0: c
      |  a --! a: noAs disabled
      |  a ->> noAs
      |}
      |// intrusion
      |w.c ->> s.b""".stripMargin,

  "Conflict" ->
    """init i0
      |i0 --> i1: a
      |i1 --> i2: b
      |i2 --> i3: c disabled
      |
      |a ->> b: on
      |on --! b: off""".stripMargin,

  "Dependencies" ->
    """aut A {
      |  init i0
      |  i0 --> i1: look
      |  i1 --> i0: restart
      |}
      |
      |aut B {
      |  init i0
      |  i0 --> i1: on
      |  i1 --> i2: goLeft disabled
      |  i1 --> i2: goRight disabled
      |  goLeft --#-- goRight
      |  i2 --> i0: off
      |}
      |
      |// dependencies
      |A.look ----> B.goLeft
      |A.look ----> B.goRight""".stripMargin,

  "Dynamic SPL" ->
    """init setup
      |setup --> setup: Safe
      |setup --> setup: Unsafe
      |setup --> setup: Encrypt
      |setup --> setup: Dencrypt
      |setup --> ready
      |ready --> setup
      |ready --> received: Receive
      |received --> routed_safe: ERoute  disabled
      |received --> routed_unsafe: Route
      |routed_safe --> sent: ESend       disabled
      |routed_unsafe --> sent: Send
      |routed_unsafe --> sent_encrypt: ESend disabled
      |sent_encrypt --> ready: Ready
      |sent --> ready: Ready
      |
      |Safe ->> ERoute
      |Safe --! Route
      |Unsafe --! ERoute
      |Unsafe ->> Route
      |Encrypt --! Send
      |Encrypt ->> ESend
      |Dencrypt ->> Send
      |Dencrypt --! ESend""".stripMargin,
    )
    "{" + examples.map{ case (k,v) => s""""$k": ${js.JSON.stringify(v)}""" }.mkString(",") + "}"
  }

  @JSExport
  def getCurrentStateText(): String = currentGraph.map(_.toString).getOrElse("")

  @JSExport
  def getCurrentStateMermaid(): String = currentGraph.map(g => RxGraph.toMermaid(g)).getOrElse("")

  @JSExport
  def getCurrentStateMermaidSimple(): String = currentGraph.map(g => RxGraph.toMermaidPlain(g)).getOrElse("")


  private def stringToQName(str: String): QName = if (str.isEmpty) QName(Nil) else QName(str.split('/').toList)
  
  private def generateSimulationJson(graph: RxGraph, traversedEdge: Option[Edge]): String = {
     val graphElementsJson = CytoscapeConverter(graph)
     
     val eventTransitions = RxSemantics.nextEdge(graph).map(_._1)
     val eventTransitionsJson = eventTransitions.map { case (from, to, lbl) =>
       s"""{"from":"$from", "to":"$to", "lbl":"$lbl", "label":"${lbl.show}", "isDelay": false}"""
     }.mkString(",")

     val delayTransitionJson = if (RxSemantics.nextDelay(graph).nonEmpty) s"""{"label":"delay", "isDelay": true}""" else ""
     val allEnabledTransitions = Seq(eventTransitionsJson, delayTransitionJson).filter(_.nonEmpty).mkString(",")

     val clocksJson = graph.clock_env.map { case (n, v) => s""""${n.show}": $v""" }.mkString(",")
     val valEnvJson = graph.val_env.map { case (n, v) => s""""${n.show}": $v""" }.mkString(",")

     val traversedJson = traversedEdge match {
       case Some((from, to, lbl)) => s"""{"from":"$from", "to":"$to", "lbl":"$lbl"}"""
       case None => "null"
     }

     s"""
       |{
       |  "graphElements": $graphElementsJson,
       |  "panelData": { 
       |     "enabled": [$allEnabledTransitions], 
       |     "clocks": {$clocksJson}, 
       |     "variables": {$valEnvJson}, 
       |     "canUndo": ${history.size > 1} 
       |  },
       |  "lastTransition": $traversedJson
       |}
       |""".stripMargin
  }
}