val scala3Version = "3.3.1"

lazy val marge = project.in(file("."))
  .enablePlugins(ScalaJSPlugin)
  .settings(
    name := "marge",
    version := "0.1.0",
    scalaVersion := scala3Version,
    scalaJSUseMainModuleInitializer := false, 
    Compile / fastLinkJS / scalaJSLinkerOutputDirectory := baseDirectory.value / "docs" / "js" / "gen",

    Compile / fullLinkJS / scalaJSLinkerOutputDirectory := baseDirectory.value / "docs" / "js" / "gen",
    libraryDependencies ++= Seq(
      "org.scala-lang.modules" %%% "scala-xml" % "2.2.0",
      "org.scalameta" %% "munit" % "0.7.29" % Test
    )
  )