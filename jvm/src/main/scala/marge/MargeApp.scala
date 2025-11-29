package marge

import com.sun.net.httpserver.{HttpServer, HttpHandler, HttpExchange}
import java.net.InetSocketAddress
import java.awt.Desktop
import java.net.URI
import java.io.{File, PrintWriter}
import scala.io.Source
import marge.syntax.{Parser2, PdlParser, Program2,MaRGeTranslator}
import marge.syntax.Program2.{RxGraph, QName}
import marge.backend.{RxSemantics, UppaalConverter,UppaalConverter2,UppaalConverter3, PdlEvaluator}

object MargeCLI {

  def main(args: Array[String]): Unit = {
    if (args.isEmpty || args(0) == "-server") {
      runServerMode()
    } else {
      runCliMode(args)
    }
  }


  def runCliMode(args: Array[String]): Unit = {
    val command = args(0)
    
    val inputFile = args.last
    
    if (command == "-help" || args.length < 2) {
      printHelp()
      return
    }

    try {
      val source = Source.fromFile(inputFile).mkString
      val graph = Parser2.parseProgram(source)

      command match {
        
        case "-text" =>
          println(graph.toString)

        case "-mermaid" =>
          println(RxGraph.toMermaid(graph))

        case "-translate" =>
          val translation = MaRGeTranslator.translate_syntax(graph, source)
          if (args.length > 2) {
            val outName = args(1)
            if (outName != inputFile) {
               new PrintWriter(outName) { write(translation); close() }
               println(s"Traducao salva em $outName")
            } else println(translation)
          } else {
            println(translation)
          }
        
        case "-uppaalRG" =>
          val xml = UppaalConverter.convert(graph, source)
          if (args.length > 2) {
            val outName = args(1)
            if (outName != inputFile) {
               new PrintWriter(outName) { write(xml); close() }
               println(s"Salvo em $outName")
            } else println(xml)
          } else {
            println(xml)
          }
        case "-uppaalGLTS" =>
          val xml = UppaalConverter2.convert(graph, source)
          if (args.length > 2) {
            val outName = args(1)
            if (outName != inputFile) {
               new PrintWriter(outName) { write(xml); close() }
               println(s"Salvo em $outName")
            } else println(xml)
          } else {
            println(xml)
          }
        case "-uppaalGRG" =>
          val xml = UppaalConverter3.convert(graph, source)
          if (args.length > 2) {
            val outName = args(1)
            if (outName != inputFile) {
               new PrintWriter(outName) { write(xml); close() }
               println(s"Salvo em $outName")
            } else println(xml)
          } else {
            println(xml)
          }

        case "-step" =>
          val transitions = RxSemantics.nextEdge(graph)
          if (transitions.isEmpty) println("Deadlock: Nenhuma transição habilitada.")
          else {
            println(s"Estado Atual: ${graph.inits.mkString(", ")}")
            println("Transições Habilitadas:")
            transitions.foreach { case ((from, to, lbl), _) =>
              println(s"  - [${lbl.show}] de ${from.show} para ${to.show}")
            }
            val delays = RxSemantics.nextDelay(graph)
            if (delays.nonEmpty) println("  - [delay] Passagem de tempo permitida")
          }

        case "-lts" =>
          println(generateLTSMermaid(graph))


        case "-pdl" =>
          if (args.length < 4) {
            println("Uso: -pdl <estado_inicial> <formula_pdl> <arquivo>")
          } else {
            val stateStr = args(1)
            val formulaStr = args(2)
            
            val qnameRes = try { 
               Right(QName(stateStr.split('.').toList))
            } catch { case e: Exception => Left(e.getMessage) }

            qnameRes match {
              case Right(startState) =>
                if (!graph.states.contains(startState)) {
                  println(s"Erro: Estado '$stateStr' não encontrado no modelo.")
                } else {
                  val formula = PdlParser.parsePdlFormula(formulaStr)
                  val result = PdlEvaluator.evaluateFormula(startState, formula, graph)
                  println(s"Modelo: $inputFile")
                  println(s"Estado: $stateStr")
                  println(s"Fórmula: $formulaStr")
                  println(s"Resultado: $result")
                }
              case Left(err) => println(s"Erro ao ler estado: $err")
            }
          }

        case _ => printHelp()
      }

    } catch {
      case e: java.io.FileNotFoundException => println(s"Arquivo não encontrado: $inputFile")
      case e: Exception => 
        println("Erro durante a execução:")
        e.printStackTrace()
    }
  }

  def generateLTSMermaid(root: RxGraph): String = {
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

    val maxStates = 2000

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

    val nodes = stateToId.map { case (st, id) =>
      val lbl = st.inits.mkString(",")
      val style = if(st == root) "style " + id + " fill:#bbf,stroke:#333,stroke-width:2px" else ""
      s"$id(\"$lbl\")\n$style"
    }.mkString("\n")

    s"""graph LR
       |${transitionsStr.reverse.mkString("\n")}
       |$nodes
       |""".stripMargin
  }

  def printHelp(): Unit = {
    println(
      """
        |Uso: java -jar MargeTool.jar [COMANDO] [OPCOES] <ARQUIVO>
        |
        |Sem argumentos: Abre a Interface Grafica (Navegador).
        |
        |Comandos CLI:
        |  -translate <arquivo>         : Traduz o codigo para GLTS (stdout)
        |  -translate <saida> <arq>     : Traduz e salva em arquivo
        |  -uppaalRG <arquivo>          : Exporta XML Uppaal (RG)
        |  -uppaalGLTS <arquivo>        : Exporta XML Uppaal (GLTS)
        |  -uppaalGRG <arquivo>         : Exporta XML Uppaal (GRG)
        |  -text <arquivo>              : Imprime representacao textual do estado inicial
        |  -mermaid <arquivo>           : Imprime representacao Mermaid do estado inicial
        |  -step <arquivo>              : Lista as transicoes habilitadas (Run Step)
        |  -lts <arquivo>               : Gera o diagrama Mermaid de TODOS os passos (LTS Completo)
        |  -pdl <estado> <form> <arq>   : Avalia formula PDL (Ex: -pdl "s0" "[a]true" modelo.txt)
        |""".stripMargin)
  }



  class ResourceHandler extends HttpHandler {
    override def handle(t: HttpExchange): Unit = {
      var path = t.getRequestURI.getPath
      if (path == "/" || path == "") path = "/index.html"
      val stream = getClass.getResourceAsStream(path)
      if (stream == null) {
        t.sendResponseHeaders(404, 0); t.getResponseBody.close()
      } else {
        if (path.endsWith(".html")) t.getResponseHeaders.set("Content-Type", "text/html; charset=utf-8")
        else if (path.endsWith(".js")) t.getResponseHeaders.set("Content-Type", "application/javascript")
        else if (path.endsWith(".css")) t.getResponseHeaders.set("Content-Type", "text/css")
        t.sendResponseHeaders(200, 0)
        stream.transferTo(t.getResponseBody)
        stream.close(); t.getResponseBody.close()
      }
    }
  }

  def runServerMode(): Unit = {
    val server = HttpServer.create(new InetSocketAddress("localhost", 0), 0)
    server.createContext("/", new ResourceHandler())
    server.start()
    val url = s"http://localhost:${server.getAddress.getPort}/index.html"
    println(s"Interface Grafica: $url")
    
    if (Desktop.isDesktopSupported && Desktop.getDesktop.isSupported(Desktop.Action.BROWSE)) {
      Desktop.getDesktop.browse(new URI(url))
    }
    Thread.currentThread().join()
  }
}