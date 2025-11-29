package marge.syntax

import marge.syntax.Formula.*
import marge.syntax.PdlProgram.*
import marge.syntax.Program2.QName
import marge.syntax.Condition
import scala.util.matching.Regex

object PdlParser {

  def parsePdlFormula(str: String): Formula = {
    val tokens = tokenize(str)
    if (tokens.isEmpty) throw new RuntimeException("Formula cannot be empty")
    val reader = new TokenReader(tokens)
    val formula = parseFormula(reader)
    if (reader.hasNext) throw new RuntimeException(s"Tokens inesperados no fim: ${reader.current}")
    formula
  }

  private def tokenize(input: String): List[String] = {
    val pattern = """(<->|->|=>|&&|\|\||&\|&|\[\]|<>|==|!=|<=|>=|[!~\[\]\(\)\{\};\+\*<>]|[a-zA-Z_][\w\.]*(\/[a-zA-Z_][\w\.]*)*|-?\d+(\.\d+)?)""".r
    pattern.findAllIn(input).toList
  }

  private class TokenReader(tokens: List[String]) {
    var pos = 0
    def current: String = if (pos < tokens.length) tokens(pos) else ""
    def hasNext: Boolean = pos < tokens.length
    def consume(): String = { val t = current; pos += 1; t }
    def eat(s: String): Boolean = if (current == s) { pos += 1; true } else false
    def expect(s: String): Unit = if (!eat(s)) throw new RuntimeException(s"Esperado '$s', encontrado '$current'")
  }


  private def parseFormula(reader: TokenReader): Formula = parseIff(reader)

  private def parseIff(reader: TokenReader): Formula = {
    var left = parseImpl(reader)
    while (reader.current == "<->") {
      reader.consume()
      val right = parseImpl(reader)
      left = Iff(left, right)
    }
    left
  }

  private def parseImpl(reader: TokenReader): Formula = {
    var left = parseOr(reader)
    if (reader.current == "->" || reader.current == "=>") {
      reader.consume()
      val right = parseImpl(reader) 
      left = Impl(left, right)
    }
    left
  }

  private def parseOr(reader: TokenReader): Formula = {
    var left = parseAnd(reader)
    while (reader.current == "||" || reader.current == "OR") {
      reader.consume()
      val right = parseAnd(reader)
      left = Or(left, right)
    }
    left
  }

  private def parseAnd(reader: TokenReader): Formula = {
    var left = parsePipeAnd(reader)
    while (reader.current == "&&" || reader.current == "AND") {
      reader.consume()
      val right = parsePipeAnd(reader)
      left = And(left, right)
    }
    left
  }

  private def parsePipeAnd(reader: TokenReader): Formula = {
    var left = parseUnary(reader)
    while (reader.current == "&|&") {
      reader.consume()
      val right = parseUnary(reader)
      left = PipeAnd(left, right)
    }
    left
  }

  private def parseUnary(reader: TokenReader): Formula = {
    val t = reader.current
    if (t == "!" || t == "~" || t == "¬") {
      reader.consume()
      Not(parseUnary(reader))
    } else if (t == "[]") {
      reader.consume()
      Box(parseUnary(reader))
    } else if (t == "<>") {
      reader.consume()
      Diamond(parseUnary(reader))
    } else if (t == "[") {
      val savePos = reader.pos
      try {
          reader.consume() // [
          val cond = parseCondition(reader)
          reader.expect("]")
          CondProp(cond)
      } catch {
          case _: Throwable =>
              reader.pos = savePos
              reader.consume() // [
              val prog = parseProgram(reader)
              reader.expect("]")
              val f = parseUnary(reader)
              BoxP(prog, f)
      }
    } else if (t == "<") {
      reader.consume()
      val prog = parseProgram(reader)
      reader.expect(">")
      val f = parseUnary(reader)
      DiamondP(prog, f)
    } else {
      parseAtom(reader)
    }
  }

  private def parseAtom(reader: TokenReader): Formula = {
    if (reader.eat("(")) {
      val f = parseFormula(reader)
      reader.expect(")")
      f
    } else {
      StateProp(parseQName(reader))
    }
  }

  
  private def parseProgram(reader: TokenReader): PdlProgram = parseChoice(reader)

  private def parseChoice(reader: TokenReader): PdlProgram = {
    var left = parseSeq(reader)
    while (reader.eat("+")) {
      val right = parseSeq(reader)
      left = Choice(left, right)
    }
    left
  }

  private def parseSeq(reader: TokenReader): PdlProgram = {
    var left = parseStar(reader)
    while (reader.eat(";")) {
      val right = parseStar(reader)
      left = Seq(left, right)
    }
    left
  }

  private def parseStar(reader: TokenReader): PdlProgram = {
    var prog = parseProgAtom(reader)
    while (reader.eat("*")) {
      prog = Star(prog)
    }
    prog
  }

  private def parseProgAtom(reader: TokenReader): PdlProgram = {
    if (reader.eat("(")) {
      val p = parseProgram(reader)
      reader.expect(")")
      p
    } else {
      Act(parseQName(reader))
    }
  }

  private def parseQName(reader: TokenReader): QName = {
    val s = reader.consume()
    if (s.contains("/")) QName(s.split('/').toList)
    else QName(s.split('.').toList)
  }

  private def parseCondition(reader: TokenReader): Condition = {
      val lhs = parseQName(reader)
      val op = reader.consume()
      
      val validOps = Set("==", "!=", "<=", ">=", "<", ">")
      
      if (!validOps.contains(op)) {
          throw new RuntimeException(s"Operador de condição inválido: $op")
      }
      
      val rhsToken = reader.consume()
      val rhs = if (rhsToken.matches("-?\\d+(\\.\\d+)?")) Left(rhsToken.toDouble) else Right(parseQNameDummy(rhsToken))
      Condition.AtomicCond(lhs, op, rhs)
  }
  
  private def parseQNameDummy(s: String): QName = {
      if (s.contains("/")) QName(s.split('/').toList) else QName(s.split('.').toList)
  }
}