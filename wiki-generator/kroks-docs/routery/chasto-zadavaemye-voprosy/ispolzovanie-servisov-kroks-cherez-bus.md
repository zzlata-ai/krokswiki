---
name: Использование сервисов KROKS через ubus
description: UBUS обеспечивает функции шины на системном уровне, чтобы быть совместимыми с ограниченными средами, например встроенными системами. Поэтому то, что сервисы KROKS могут работать через ubus, является несомненным плюсом. В этой статье вы узнаете подробнее об этом.
---
# Использование сервисов Крокс через ubus

## ***Пример использования ubus***

```bash
root@kndrt31r27:~# ubus
Usage: ubus [<options>] <command> [arguments...]
Options:
 -s <socket>:           Set the unix domain socket to connect to
 -t <timeout>:          Set the timeout (in seconds) for a command to complete
 -S:                    Use simplified output (for scripts)
 -v:                    More verbose output
 -m <type>:             (for monitor): include a specific message type
                        (can be used more than once)
 -M <r|t>               (for monitor): only capture received or transmitted traffic

Commands:
 - list [<path>]                        List objects
 - call <path> <method> [<message>]     Call an object method
 - listen [<path>...]                   Listen for events
 - send <type> [<message>]              Send an event
 - wait_for <object> [<object>...]      Wait for multiple objects to appear on ubus
 - monitor                              Monitor ubus traffic
```

## ***Получение списка работающих сервисов***

```bash
root@kndrt41r1:~# ubus list
container
dhcp
dnsmasq
dnsmasq.dns
file
hostapd
hostapd.ap1001
hostapd.ap1002
hotplug.dhcp
hotplug.firmware
hotplug.ieee80211
hotplug.iface
hotplug.ipsec
hotplug.neigh
hotplug.net
hotplug.ntp
hotplug.tftp
hotplug.tty
hotplug.usb
hotplug.usbmisc
hotplug.wwan
iwinfo
kroks.config
kroks.dev.modem
kroks.dev.modem.bearer
kroks.dev.modem.cell
kroks.dev.modem.message
kroks.dev.modem.simcard
kroks.dev.modem.ussd
kroks.net.check
log
luci
luci-rpc
luci.wireguard
network
network.device
network.interface
network.interface.lan
network.interface.loopback
network.interface.modem1
network.interface.wan
network.interface.wan6
network.rrdns
network.wireless
rc
service
session
system
uci
wpa_supplicant
```

## ***Обращение к сервису***

```bash
root@kndrt41r1:~# ubus call kroks.dev.modem process
{
  "modem1": {
    "execute": false,
    "stateChanged": false,
    "stateChangedTime": 96,
    "busy": false,
    "connectedReconnectCount": 0,
    "timestamp": 11774,
    "configuredStage": 1,
    "configuredCount": 1,
    "configured": true,
    "executeMessage": false,
    "state": "connected",
    "busyMessage": false,
    "locked": false,
    "stateDuration": 11678
  }
}
```

## ***Смена SIM-карты***

```bash
root@kndrt41r1:~# ubus call kroks.dev.modem.simcard change "{'modem':'modem1','simcard':'modem1sim2'}"
{
  "modem1": {
    "modem1sim2": {
      "dbus": "/org/freedesktop/ModemManager1/SIM/2",
      "imsi": "250202107244361",
      "iccid": "89701202145600345827",
      "operator": {
        "code": "25020",
        "name": "Tele2"
      },
      "enabled": true,
      "simchange": [
        
      ]
    }
  }
}
```

## ***Получить список аргументов для modem1***

```bash
root@kndrt41r1:~# ubus -v list kroks.dev.modem
'kroks.dev.modem' @4920124a
  "command":{"payload":"String","method":"String","modem":"String"}
  "reload":{}
  "device":{}
  "config":{}
  "process":{}
```
