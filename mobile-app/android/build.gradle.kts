allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    afterEvaluate {
        if (project.hasProperty("android")) {
            val extension = project.extensions.findByName("android")
            if (extension != null) {
                try {
                    val getNamespace = extension.javaClass.getMethod("getNamespace")
                    val namespace = getNamespace.invoke(extension) as? String
                    if (namespace == null) {
                        val setNamespace = extension.javaClass.getMethod("setNamespace", String::class.java)
                        val group = project.group.toString()
                        val ns = if (group.isNotEmpty() && group != "null") group else "com.example.flutterplugin.${project.name.replace("-", "_")}"
                        setNamespace.invoke(extension, ns)
                    }
                } catch (e: Exception) {
                }
            }
        }
    }
    project.evaluationDependsOn(":app")
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
