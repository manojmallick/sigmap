# Sample R source representative of a Shiny dashboard / data analysis
# project. Mixes top-level function definitions, default args, the `=` form,
# S3/S4 patterns, R6 + S7 classes, and roxygen2 blocks.

#' Compute a moving average over a numeric vector.
#'
#' @param x   numeric vector
#' @param n   integer window size, defaults to 5
#' @return    numeric vector of the same length as x
moving_average <- function(x, n = 5) {
  stats::filter(x, rep(1 / n, n), sides = 2)
}

# Equals form is also valid in R
greet = function(name = "world", greeting = "hello") {
  paste0(greeting, ", ", name)
}

#' @title Load a CSV with sensible defaults
#' @param path  path to the file
#' @description Wraps read.csv with a wider NA-string set.
load_data <- function(
  path,
  sep = ",",
  na.strings = c("NA", "", "n/a"),
  stringsAsFactors = FALSE
) {
  read.csv(path, sep = sep, na.strings = na.strings, stringsAsFactors = stringsAsFactors)
}

# Shiny server function shape
server <- function(input, output, session) {
  output$plot <- renderPlot({ plot(input$x) })
}

# Private function (leading dot) — should be skipped
.internal_helper <- function(x) x * 2

# S4 patterns
setClass("Point", representation(x = "numeric", y = "numeric"))

setGeneric("distance_to_origin", function(p) standardGeneric("distance_to_origin"))

setMethod("distance_to_origin", "Point", function(p) {
  sqrt(p@x^2 + p@y^2)
})

#' A simple R6 stack
#'
#' @description Push and pop values onto an internal vector.
Stack <- R6::R6Class("Stack",
  public = list(
    initialize = function(values = list()) {
      private$.items <- values
    },
    push = function(x) {
      private$.items <- c(private$.items, list(x))
      invisible(self)
    },
    pop = function() {
      if (length(private$.items) == 0) return(NULL)
      x <- private$.items[[length(private$.items)]]
      private$.items <- private$.items[-length(private$.items)]
      x
    },
    size = function() length(private$.items)
  ),
  private = list(
    .items = NULL
  )
)

# S7 class + method dispatch
Range <- new_class("Range", properties = list(
  lo = class_numeric,
  hi = class_numeric
))

method(format, Range) <- function(x, ...) {
  sprintf("[%g, %g]", x@lo, x@hi)
}
