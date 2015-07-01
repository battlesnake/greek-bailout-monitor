#!/bin/bash

set -euo pipefail

case homepage in
project)
	declare -r url='https://www.indiegogo.com/projects/greek-bailout-fund'
	declare -r xpath='//*[contains(@class, "i-balance")]//*[starts-with(@class, "currency")]/text()'
	;;
homepage)
	declare -r url='https://www.indiegogo.com'
	declare -r xpath='//a[contains(@class, "i-project")][starts-with(@href, "/projects/greek-bailout-fund")]//*[contains(@class, "currency")]/span/text()'
	;;
*)
	exit 1
	;;
esac

declare -ri interval=60

declare -r log='greek-log.tsv'

declare -r tmp="$(mktemp)"

trap clean_temp EXIT

function require {
	if ! which "$1" &>/dev/null; then
		printf >&2 -- 'Required program missing: "%s"\n' "$1"
		return 1
	fi
}

function clean_temp {
	rm -f -- "${tmp}.*"
}

function init_log {
	touch "${log}"
	exec 3>>"${log}"
}

function log {
	printf >&3 -- '%s' "$1"
	shift
	printf >&3 -- '\t%s' "$@"
	printf >&3 -- '\n'
}

function scrape {
	local -r html="${tmp}.html"
	local -r xml="${tmp}.xml"

	rm -f -- "${html}" "${xml}"

	curl --silent --max-time "${interval}" "${url}" > "${html}"

	xmllint --html --xmlout --format --nonet --nowarning --recover --output "${xml}" "${html}" 2>/dev/null

	local -r value_str="$(xmlstarlet sel -t -v "${xpath}" "${xml}")"

	if ! printf -- '%s' "${value_str}" | grep -qxP '.[\d,\.\s]+\s?\w+'; then
		printf >&2 -- 'Failed to parse currency value "%s"\n' "${value_str}"
		printf -- 'ERROR'
		return 1
	fi

	local -r value="$(printf -- '%s' "${value_str}" | sed -e 's/[^0-9]//g')"

	printf -- '%s' "${value}"
}

function timestamp {
	date +%s
}

function monitor {
	local -i next="$(timestamp)"
	while true; do
		while (( "$(timestamp)" < next )); do
			printf >&2 -- '.'
			sleep 0.1
		done
		next+=interval
		local now="$(date -uIseconds)"
		local value="$(scrape)"
		log "${now}" "${value}"
		printf >&2 -- ' scrape: %s\n' "${value}"
	done
}

require 'mktemp'
require 'curl'
require 'xmllint'
require 'xmlstarlet'
require 'sed'
require 'date'

if (( $# == 0)); then
	set -- log
fi

while (( $# )); do
	declare arg="$1"
	shift
	printf >&2 -- 'Processing command "%s"...\n' "${arg}"
	case "${arg}" in
	test) printf >&2 -- 'Scraped: "%s"\n' "$(scrape)";;
	log)
		init_log
		monitor
		;;
	*)
		printf >&2 -- 'Invalid command: "%s"\n' "${arg}"
		exit 1
		;;
	esac
done
