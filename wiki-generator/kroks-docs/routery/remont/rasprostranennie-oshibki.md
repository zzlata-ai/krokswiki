---
name: Распространенные ошибки
description: В этой статье будет пополняться распростраенными проблема и ошибками, которые могут возниктуть в ходе эксплуатации роутера, а также способами их решения.
---
# Распространенные ошибки

:::tip  
Зачастую для решения проблемы вам может понадобиться подключиться к роутеру по SSH. Как это сделать, вы можете узнать [здесь](/docs/routery/chasto-zadavaemye-voprosy/podklyuchenie-po-ssh.md).

:::

## Ошибка memory

Характеризуется возникновением следующей ошибки при попытке войти в веб-интерфейс роутера:

```
Unable to render any theme header template, last error was: Unable to compile >'themes/material/header' as Lua template:

/usr/lib/lua/luci/ucodebridge.lua:23: /usr/lib/lua/luci/template.lua:158: Failed to load template 'themes/material/header'. Either parsing template '/usr/lib/lua/luci/view/themes/material/header.htm': No such file or directory in error(), file [/C] called from function run (/usr/lib/lua/luci/ucodebridge.lua:23) called from function [anonymous function] (/usr/lib/lua/luci/ucodebridge.lua:31)

In [anonymous function] (), file /usr/share/ucode/luci/runtime.uc, line 106, byte 62:  
called from function [anonymous function] (/usr/share/ucode/luci/runtime.uc:166:60)  
called from function [anonymous function] (/usr/share/ucode/luci/dissector.uc:915:3)  
called from anonymous function (/www/cgi-bin/luci:39:13)

'vm.get('G', 'luci', 'ucodebridge', 'compile').call(path);'  
Near here    ---------------------------------------------^
```

Может появиться из-за проблем в работе раздела **memory** вашего роутера.  
Решением в такой ситуации будет сброс этого раздела.

::: warning
Обратите внимание, что это "жесткий" способ, и его нужно применять только в случае необходимости восстановления или специальных ситуаций, например, так как в примере выше.  
:::

Для того чтобы произвести сброс раздела **memory** вам необходимо [подключиться к роутеру по SSH](/docs/routery/chasto-zadavaemye-voprosy/podklyuchenie-po-ssh.md) и ввести следующую команду:

```bash
mtd erase memory && firstboot -r -y
```

После того как ваш роутер снова станет доступен, проблема должна исчезнуть.
