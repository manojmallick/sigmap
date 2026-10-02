package demo

class Greeter {
    String greet(String name) {
        return "Hello ${name}"
    }

    def configure(Map options = [:]) {
        options.each { key, value -> println("${key}=${value}") }
    }
}

interface Runner {
    void run(String input)
}

def handler = { String name, int count ->
    println "${name}: ${count}"
}

def buildMessage(String name, Map options = compute(1, 2)) {
    return "message: ${name}"
}

repositories {
    mavenCentral()
}
