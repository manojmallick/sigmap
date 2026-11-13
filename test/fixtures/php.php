<?php

namespace Example;

class UserService
{
    private $repo;

    public function __construct(UserRepository $repo)
    {
        $this->repo = $repo;
    }

    public function getUser(string $id): ?User
    {
        return $this->repo->findById($id);
    }

    public function createUser(array $data): User
    {
        return $this->repo->save(new User($data));
    }

    protected function validateUser(User $user): bool
    {
        return !empty($user->id);
    }
}

interface Repository
{
    public function findById(string $id): mixed;
    public function save(mixed $entity): mixed;
}

function hashPassword(string $password): string
{
    return $password;
}

final class Ledger extends \App\Base\Store implements \Countable, App\Audit\Auditable
{
    public function total(): int
    {
        return 0;
    }
}

final readonly class Money
{
    public function __construct(public int $cents) {}

    public function add(Money $other): Money
    {
        return new Money($this->cents + $other->cents);
    }
}

enum Suit: string implements HasLabel
{
    case Hearts = 'H';

    public function label(): string
    {
        return $this->name;
    }
}

interface Account extends Repository, \Stringable
{
    public function balance(): int;
}
