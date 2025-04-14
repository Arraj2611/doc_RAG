# This file makes the db directory a Python package
from .mongodb import (
    init_mongodb,
    close_mongodb,
    get_database,
    User,
    Document,
    ChatMessage,
    ChatSession,
    create_user,
    get_user_by_id,
    get_user_by_username,
    update_user_preferences,
    create_document,
    get_documents_by_user_id,
    get_document_by_id,
    update_document_status,
    create_chat_session,
    get_chat_sessions_by_user_id,
    get_chat_session_by_id,
    add_chat_message,
    get_chat_messages_by_session_id
)
