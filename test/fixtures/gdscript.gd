# Player controller fixture for SigMap GDScript extractor.
class_name Player
extends CharacterBody2D

signal health_changed(new_value: int)
signal died

const MAX_SPEED := 300.0
const ACCEL = 50.0

enum State { IDLE, RUN, JUMP, FALL }

@export var speed: float = 200.0
@export_range(0, 100) var max_health: int = 100
@onready var sprite: Sprite2D = $Sprite2D
var current_health: int
var _internal_state: int = 0


func _ready() -> void:
	current_health = max_health


func _physics_process(delta: float) -> void:
	velocity.x = speed * delta


func take_damage(amount: int) -> bool:
	current_health -= amount
	health_changed.emit(current_health)
	return current_health <= 0


func heal(amount: int) -> void:
	current_health += amount


static func from_dict(data: Dictionary) -> Player:
	return Player.new()


func _private_helper():
	return _internal_state


class Inventory:
	var items: Array

	func add(item) -> void:
		items.append(item)

	func remove(item) -> bool:
		return items.erase(item)
