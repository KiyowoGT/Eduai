from motor.motor_asyncio import AsyncIOMotorClient
from core.config import MONGO_URL, DB_NAME

if MONGO_URL:
    client = AsyncIOMotorClient(MONGO_URL)
    _db = client[DB_NAME]

    class ImmutableAuditLogsCollection:
        def __init__(self, collection):
            self._collection = collection

        def __getattr__(self, name):
            if name in (
                'update_one', 'update_many', 'delete_one', 'delete_many',
                'replace_one', 'find_one_and_update', 'find_one_and_delete',
                'find_one_and_replace', 'drop'
            ):
                def blocked(*args, **kwargs):
                    raise PermissionError("Audit logs bersifat immutable dan tidak dapat dimodifikasi atau dihapus")
                return blocked
            return getattr(self._collection, name)

        def __getitem__(self, name):
            return getattr(self._collection, name)

    class CustomDatabase:
        def __init__(self, database):
            self._database = database
            self.audit_logs = ImmutableAuditLogsCollection(database.audit_logs)

        def __getattr__(self, name):
            if name == "audit_logs":
                return self.audit_logs
            return getattr(self._database, name)

        def __getitem__(self, name):
            if name == "audit_logs":
                return self.audit_logs
            return self._database[name]

    db = CustomDatabase(_db)
else:
    client = None
    db = None
