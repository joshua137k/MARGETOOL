package rta.syntax

import rta.syntax.Program2.{RxGraph, QName}
import rta.syntax.{Condition, CounterUpdate, UpdateExpr, Statement, UpdateStmt, IfThenStmt}
import rta.syntax.Condition.*
import scala.util.matching.Regex

object Parser2 {


  private def tokenize(input: String): List[String] = {
    val pattern = """(//.*)|(->>|--!|--x|-->|---->|--#--)|(\b(?:AND|OR|if|then|else|disabled|init|aut|int|clock|inv)\b)|(:=|==|!=|<=|>=|&&|\|\||[{}();,:=\+\-\*\/<>])|([a-zA-Z_][\w\.]*'?)|(-?\d+(\.\d+)?)""".r

    pattern.findAllMatchIn(input).flatMap { m =>
      if (m.group(1) != null) None 
      else Some(m.matched)         
    }.toList
  }


  private class TokenReader(tokens: List[String]) {
    var pos = 0
    
    def current: String = if (pos < tokens.length) tokens(pos) else ""
    def hasNext: Boolean = pos < tokens.length
    
    def consume(): String = {
      val t = current
      pos += 1
      t
    }
    
    def eat(s: String): Boolean = {
      if (current == s) {
        pos += 1
        true
      } else false
    }
    
    def expect(s: String): Unit = {
      if (!eat(s)) throw new RuntimeException(s"Erro de Sintaxe: Esperado '$s', encontrado '$current'")
    }

    def parseQName(): QName = {
      val s = consume()
      if (s.contains(".")) QName(s.split('.').toList) else QName(List(s))
    }
    
    def tryParseInt(): Int = consume().toInt
    def tryParseDouble(): Double = consume().toDouble
  }


  def parseProgram(str: String): RxGraph = {
    val tokens = tokenize(str)
    val reader = new TokenReader(tokens)
    parseBlock(reader)
  }

  private def parseBlock(reader: TokenReader): RxGraph = {
    var rx = RxGraph()
    
    while (reader.hasNext && reader.current != "}") {
      val token = reader.current
      
      if (reader.eat("init")) {
        rx = rx.addInit(reader.parseQName())
      }
      else if (reader.eat("int")) {
        val name = reader.parseQName()
        reader.expect("=")
        val value = reader.tryParseInt()
        rx = rx.addVariable(name, value)
      }
      else if (reader.eat("clock")) {
        rx = rx.addClock(reader.parseQName())
        while (reader.eat(",")) {
          rx = rx.addClock(reader.parseQName())
        }
      }
      else if (reader.eat("inv")) {
        val state = reader.parseQName()
        reader.expect(":")
        val cond = parseCondition(reader)
        rx = rx.addInvariant(state, cond)
      }
      else if (reader.eat("aut")) {
        val name = reader.parseQName()
        reader.expect("{")
        val innerRx = parseBlock(reader)
        reader.expect("}")
        rx = rx ++ (name / innerRx)
      }
      else if (token == ";") {
        reader.consume() 
      }
      else {
        rx = parseEdge(reader, rx)
      }
      
      reader.eat(";") 
    }
    rx
  }

  private def parseEdge(reader: TokenReader, rx: RxGraph): RxGraph = {
    val from = reader.parseQName()
    val arrow = reader.consume()
    val to = reader.parseQName()
    
    var label = QName(Nil)
    if (reader.eat(":")) {
      label = reader.parseQName()
    }

    var cond: Option[Condition] = None
    var updates: List[Statement] = Nil
    var disabled = false

    var parsingAttributes = true
    while (parsingAttributes && reader.hasNext) {
       val t = reader.current
       
       if (t == "disabled") {
         reader.consume()
         disabled = true
       } 
       else if (t == "if") {
         reader.consume()
         cond = Some(parseCondition(reader))
         if (reader.eat("then")) {
            reader.expect("{")
            updates = parseStatementsBlock(reader)
            reader.expect("}")
         }
       } 
       else if (t.endsWith("'")) {
           updates = updates :+ parseUpdate(reader)
       } 
       else {
           parsingAttributes = false
       }
    }

    val newRx = arrow match {
      case "-->" => rx.addEdge(from, to, label, cond, updates)
      case "->>" => rx.addOn(from, to, label, cond, updates)
      case "--!" | "--x" => rx.addOff(from, to, label, cond, updates)
      case "---->" => rx.addOn(from, to, label, cond, updates).addOff(to, to, label, cond, updates)
      case "--#--" => rx.addOff(from, to, label, cond, updates).addOff(to, from, label, cond, updates)
      case _ => throw new RuntimeException(s"Seta desconhecida: $arrow")
    }

    if (disabled) newRx.deactivate(from, to, label) else newRx
  }

  private def parseCondition(reader: TokenReader): Condition = {
    def parseAtom(): Condition = {
      if (reader.eat("(")) {
        val c = parseCondition(reader)
        reader.expect(")")
        c
      } else {
        val lhs = reader.parseQName()
        val op = reader.consume()
        val rhsToken = reader.current
        val rhs = if (rhsToken.matches("-?\\d+(\\.\\d+)?")) {
             Left(reader.tryParseDouble())
        } else {
             Right(reader.parseQName())
        }
        AtomicCond(lhs, op, rhs)
      }
    }

    var left = parseAtom()
    while (reader.current == "AND" || reader.current == "&&" || reader.current == "OR" || reader.current == "||") {
      val logicOp = reader.consume()
      val right = parseAtom()
      if (logicOp == "OR" || logicOp == "||") left = Or(left, right)
      else left = And(left, right)
    }
    left
  }

  private def parseStatementsBlock(reader: TokenReader): List[Statement] = {
    var stmts = List.empty[Statement]
    while (reader.current != "}") {
        if (reader.eat("if")) {
            val cond = parseCondition(reader)
            reader.expect("then")
            reader.expect("{")
            val inner = parseStatementsBlock(reader)
            reader.expect("}")
            stmts = stmts :+ IfThenStmt(cond, inner)
        } else {
            stmts = stmts :+ parseUpdate(reader)
        }
        reader.eat(";")
    }
    stmts
  }

  private def parseUpdate(reader: TokenReader): UpdateStmt = {
      val vRaw = reader.parseQName()
      if (!vRaw.n.last.endsWith("'")) throw new RuntimeException(s"Esperado var', encontrado ${vRaw.show}")
      
      val cleanName = QName(vRaw.n.init :+ vRaw.n.last.dropRight(1))
      
      reader.expect(":=")
      
      val firstToken = reader.consume()
      val expr = if (firstToken.matches("-?\\d+")) UpdateExpr.Lit(firstToken.toInt) else UpdateExpr.Var(stringToQName(firstToken))
      
      if (reader.current == "+" || reader.current == "-") {
          val op = reader.consume()
          val secondToken = reader.consume()
          val rhs = if (secondToken.matches("\\d+")) Left(secondToken.toInt) else Right(stringToQName(secondToken))
          
          val varFromExpr = expr match {
              case UpdateExpr.Var(q) => q
              case _ => throw new RuntimeException("Expressão complexa não suportada no parser simples")
          }
          
          if (op == "+") UpdateStmt(CounterUpdate(cleanName, UpdateExpr.Add(varFromExpr, rhs)))
          else UpdateStmt(CounterUpdate(cleanName, UpdateExpr.Sub(varFromExpr, rhs)))
      } else {
          UpdateStmt(CounterUpdate(cleanName, expr))
      }
  }

  private def stringToQName(s: String): QName = {
      if (s.contains(".")) QName(s.split('.').toList) else QName(List(s))
  }

  def pp[A](parser: Any, str: String): Either[String, A] = {
      try { Right(stringToQName(str).asInstanceOf[A]) } catch { case e: Throwable => Left(e.getMessage) }
  }
  def qname: Any = null
}