"""Invoke the registered FIN Expert tools in a fresh MCP process; never raw HTTP."""
import asyncio
import json
import sys
from pathlib import Path
from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

PROFILE = Path(r'C:\Users\11607\FINExpert\finprofile')

async def main():
    server = StdioServerParameters(
        command=str(PROFILE / '.venv/Scripts/fin-expert-mcp.exe'),
        # MCP's default inherited environment omits NO_PROXY on Windows.
        # Keep registered loopback FIN traffic out of the Windows proxy.
        args=[], cwd=str(PROFILE), env={'NO_PROXY': 'localhost,127.0.0.1,::1'},
    )
    async with stdio_client(server) as (read, write):
        async with ClientSession(read, write) as session:
            await session.initialize()
            if len(sys.argv) > 1:
                request = json.loads(Path(sys.argv[1]).read_text(encoding='utf-8-sig'))
                result = await session.call_tool(request['tool'], request.get('arguments', {}))
                payload = result.structuredContent
                if payload is None:
                    payload = {'isError': result.isError, 'messages': [item.text for item in result.content if hasattr(item, 'text')]}
                print(json.dumps(payload, ensure_ascii=False), flush=True)
            else:
                for name, arguments in [
                    ('fin_live_list_connections', {}),
                    ('fin_live_test_connection', {'connection_id':'local-mytest'}),
                ]:
                    result = await session.call_tool(name, arguments)
                    print(json.dumps(result.structuredContent, ensure_ascii=False), flush=True)

if __name__ == '__main__':
    asyncio.run(main())
