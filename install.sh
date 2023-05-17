mkdir -p /mnt/autoshare/
opkg update
#opkg list-upgradable | cut -f 1 -d ' ' | grep lighttpd | xargs opkg upgrade
opkg install lighttpd-mod-auth lighttpd-mod-authn_file lighttpd-mod-webdav lighttpd-mod-simple_vhost
service lighttpd restart
service lighttpd-public restart
service lighttpd-public enable
service firewall reload
