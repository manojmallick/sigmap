// C++ fixture
#include <string>
#include <memory>

class UserService {
public:
    UserService(std::shared_ptr<Repository> repo);
    User getUser(const std::string& id) const;
    User createUser(const CreateUserDto& dto);
    virtual ~UserService();

private:
    void _validate(const User& user);

protected:
    std::shared_ptr<Repository> repo_;
};

struct Repository {
    virtual User findById(const std::string& id) = 0;
    virtual bool save(const User& user) = 0;
};

std::string hashPassword(const std::string& password);

namespace util {

enum class Level { Debug, Info };

template <typename T>
T clamp(T v, T lo, T hi) {
    return v < lo ? lo : (v > hi ? hi : v);
}

}  // namespace util

std::string UserService::describe() const { return "user"; }
