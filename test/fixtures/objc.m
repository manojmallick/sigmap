// Objective-C fixture
#import <Foundation/Foundation.h>

typedef NS_ENUM(NSInteger, UserRole) {
    UserRoleGuest = 0,
    UserRoleMember = 1,
    UserRoleAdmin = 2,
};

typedef NS_OPTIONS(NSUInteger, UserPermissions) {
    UserPermissionNone = 0,
    UserPermissionRead = 1 << 0,
    UserPermissionWrite = 1 << 1,
};

typedef struct Point2D {
    double x;
    double y;
} Point2D;

@protocol Repository <NSObject>
@required
- (User *)findById:(NSString *)userId;
- (BOOL)saveUser:(User *)user error:(NSError **)error;
@optional
- (void)clearCache;
@end

@interface UserService : NSObject <Repository>
@property (nonatomic, strong) id<Repository> repo;
@property (nonatomic, copy, readonly) NSString *serviceName;

+ (instancetype)serviceWithRepo:(id<Repository>)repo;
- (instancetype)initWithRepo:(id<Repository>)repo;
- (User *)getUser:(NSString *)userId;
- (void)createUser:(CreateUserDto *)dto completion:(void (^)(User *user, NSError *error))completion;
@end

@interface UserService (Logging)
- (void)logServiceStatus;
@end

@implementation UserService

+ (instancetype)serviceWithRepo:(id<Repository>)repo {
    return [[self alloc] initWithRepo:repo];
}

- (instancetype)initWithRepo:(id<Repository>)repo {
    if (self = [super init]) {
        _repo = repo;
    }
    return self;
}

- (User *)getUser:(NSString *)userId {
    return [self.repo findById:userId];
}

- (void)createUser:(CreateUserDto *)dto completion:(void (^)(User *user, NSError *error))completion {
    // create user implementation
}

@end

NSString *hashPassword(NSString *password) {
    return password;
}

static inline BOOL isValidId(NSString *identifier) {
    return identifier.length > 0;
}
