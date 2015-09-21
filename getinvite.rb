#!/usr/bin/env ruby
# -*- coding: utf-8 -*-
require 'rubygems'
require 'bundler/setup'
require 'mechanize'
require 'tweetstream'
require 'open-uri'
require 'logger'
require 'uri'
require 'xmlsimple'
require 'net/https'
require 'dm-core'

DataMapper.setup(:default, 'mongo://%s/oneinvites' % ENV['mongo'])

class Emailsaccounts
  include DataMapper::Mongo::Resource

  property :id, ObjectId
  property :email, String
  property :password, String
  property :urlhash, String
  property :invite, Boolean, :default  => false
  property :sell, Boolean, :default  => false
  property :start, Integer
  property :end, Integer
  property :created_at, DateTime
  property :updated_at, DateTime
end

DataMapper.finalize

class Oneplus
  attr_accessor :date_start, :date_end, :title

  def initialize(st, en, ti)
    @date_start = st
    @date_end = en
    @title = ti
  end
end

$stdout.sync = true

@us = Emailsaccounts.first(:sell => false, :invite => false, :order => [ :created_at.asc ])
puts @us.email

TweetStream.configure do |config|
  config.consumer_key       = ENV['TWITTER_CONSUMER_KEY']
  config.consumer_secret    = ENV['TWITTER_CONSUMER_KEY_SECRET']
  config.oauth_token        = ENV['TWITTER_ACCESS_TOKEN']
  config.oauth_token_secret = ENV['TWITTER_ACCESS_TOKEN_SECRET']
  config.auth_method        = :oauth
end

@a = Mechanize.new { |agent|
  agent.user_agent_alias = 'Windows Chrome'
}

@count = 0
begin
  @a.get('https://account.oneplus.net/login') do |app|
    app.form_with(:action => 'https://account.oneplus.net/login') do |f|
      f.email      = @us.email
      f.password   = @us.password
    end.click_button
  end
rescue
 puts "Error FORM #{@us.email}"
end

puts @a.page.title

if @a.page.title != 'Edit User Information - OnePlus Account'
  urlp = URI.parse('https://api.pushover.net/1/messages.json')
  req = Net::HTTP::Post.new(urlp.path)
  req.set_form_data({
                      :token => ENV['PUSHOVER_TOKEN'],
                      :user => ENV['PUSHOVER_USER'],
                      :title => "OnePlus",
                      :message => "Error login #{@us.email}"
                    })
  res = Net::HTTP.new(urlp.host, urlp.port)
  res.use_ssl = true
  res.verify_mode = OpenSSL::SSL::VERIFY_PEER
  res.start { |http|
    http.request(req)
  }
end

def getinvite(url)
  begin
    @a.get(url) do |m|
      if (m.uri.to_s.match(/(invites.oneplus.net\/claim\/GL[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/))
        puts url
        if (m.at('p.h3.text-left.text-red').text.strip == 'You entered an invalid invite')
          puts "Used invite"
        else
          @t2 = Time.now
          @delta = @t2 - @t1
          puts "Time #{@delta}"
          puts m.uri.to_s
          puts m.title
          @a.get('https://invites.oneplus.net/my-invites') do |app|
            if @a.page.title != 'My invites'
              urlp = URI.parse('https://api.pushover.net/1/messages.json')
              req = Net::HTTP::Post.new(urlp.path)
              req.set_form_data({
                                  :token => ENV['PUSHOVER_TOKEN'],
                                  :user => ENV['PUSHOVER_USER'],
                                  :title => "OnePlus",
                                  :message => "Error login #{@us.email}"
                                })
              res = Net::HTTP.new(urlp.host, urlp.port)
              res.use_ssl = true
              res.verify_mode = OpenSSL::SSL::VERIFY_PEER
              res.start { |http|
                http.request(req)
              }
              @a.get('https://account.oneplus.net/login') do |login|
                login.form_with(:action => 'https://account.oneplus.net/login') do |f|
                  f.email      = @us.email
                  f.password   = @us.password
                end.click_button
              end
              @a.get('https://invites.oneplus.net/my-invites')
              puts @a.page.title
            end
            inv = Array.new
            app.search('.invite-card').each do |invite|
              if !invite.at('time').nil?
                t1 = Time.now
                t2 = Time.now + invite.at('time')['data-time'].to_i
                inv.push(Oneplus.new(t1, t2, invite.at('p.card-type').text.strip))
              end
            end
            d = inv.sort { |a,b| b.date_end <=> a.date_end }
            if !d[0].nil?
              t1 = d[0].date_start.to_i
              t2 = d[0].date_end.to_i
              @us.update(:invite => true, :start => t1, :end => t2, :updated_at => Time.now)
              left = Time.at(t2-t1).utc.strftime('%H:%M:%S')
              urlp = URI.parse('https://api.pushover.net/1/messages.json')
              req = Net::HTTP::Post.new(urlp.path)
              req.set_form_data({
                                  :token => ENV['PUSHOVER_TOKEN'],
                                  :user => ENV['PUSHOVER_USER'],
                                  :title => "#{d[0].title}",
                                  :message => "#{@us.email}\n#{left}\n#{@delta}"
                                })
              res = Net::HTTP.new(urlp.host, urlp.port)
              res.use_ssl = true
              res.verify_mode = OpenSSL::SSL::VERIFY_PEER
              res.start { |http|
                http.request(req)
              }
              @a.get('https://account.oneplus.net/onepluslogout')
              @us = Emailsaccounts.first(:sell => false, :invite => false, :order => [ :created_at.asc ])
              begin
                @a.get('https://account.oneplus.net/login') do |login|
                  login.form_with(:action => 'https://account.oneplus.net/login') do |f|
                    f.email      = @us.email
                    f.password   = @us.password
                  end.click_button
                end
              rescue
                puts "Error FORM #{@us.email}"
              end
              if @a.page.title != 'Edit User Information - OnePlus Account'
                urlp = URI.parse('https://api.pushover.net/1/messages.json')
                req = Net::HTTP::Post.new(urlp.path)
                req.set_form_data({
                                    :token => ENV['PUSHOVER_TOKEN'],
                                    :user => ENV['PUSHOVER_USER'],
                                    :title => "OnePlus",
                                    :message => "Error login #{@us.email}"
                                  })
                res = Net::HTTP.new(urlp.host, urlp.port)
                res.use_ssl = true
                res.verify_mode = OpenSSL::SSL::VERIFY_PEER
                res.start { |http|
                  http.request(req)
                }
              end
            end
          end
        end
      else
        puts 'Wrong url'
      end
    end
  rescue
    puts "Error getinvite"
  end
end

def matchUrl(url)
  begin
    if (url.match(/invites.oneplus.net\/claim/i))
      getinvite(url)
    elsif (url.match(/onepl.us/i))
      getinvite(url)
    elsif (url.match(/mandrillapp.com/i))
      getinvite(url)
    elsif (url.match(/bit.ly/i))
      getinvite(url)
    elsif (url.match(/j.mp/i))
      getinvite(url)
    elsif (url.match(/ow.ly/i))
      getinvite(url)
    elsif (url.match(/goo.gl/i))
      getinvite(url)
    elsif (url.match(/fb.me/i))
      getinvite(url)
    elsif (url.match(/lnkd.in/i))
      getinvite(url)
    end
  rescue
    puts "Error match url"
  end
end

def getForum
  while true
    begin
      xml_data = URI.parse('https://forums.oneplus.net/forums/-/index.rss').read

      data = XmlSimple.xml_in(xml_data)

      data['channel'][0]['item'].each do |item|
        if (item['encoded'][0].match(/(GL[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/))
          m = item['encoded'][0].match(/(GL[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/)
          t = 'https://invites.oneplus.net/claim/%s' % m
          getinvite(t)
        end
        urls = URI.extract(item['encoded'][0], ['http', 'https'])
        urls.each do |u|
          @t1 = Time.now
          matchUrl(u)
        end
      end
    rescue
      puts "Error forum"
    end
    sleep 1
  end
end

def urlTwitter(urls)
  begin
    urls.each do |u|
      @t1 = Time.now
      @a.get(u) do |p|
        html = Nokogiri::HTML(p.body)
        s = html.xpath('//noscript/meta')[0]
        url = s['content'].replace(s['content'].gsub(/0;URL=/, ''))
        matchUrl(url)
      end
    end
  rescue
    puts "Error get url from twitter stream"
  end
end

def getTwitter
  begin
    TweetStream::Client.new.on_error do |message|
      puts "Error twitter stream"
      puts message
    end.track('oneplus') do |status|
      if (status.text.match(/(GL[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/))
        t = 'https://invites.oneplus.net/claim/%s' % status.text.match(/(GL[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/)
        getinvite(t)
      end
      urls = URI.extract(status.text, ['http', 'https'])
      urlTwitter(urls)
      if (@count == 100)
        @a.get('https://invites.oneplus.net/my-invites')
        puts "#{@count} #{@us.email} #{@a.page.title} #{Time.now}"
        @count = 0
        if @a.page.title != 'My invites'
          urlp = URI.parse('https://api.pushover.net/1/messages.json')
          req = Net::HTTP::Post.new(urlp.path)
          req.set_form_data({
                              :token => ENV['PUSHOVER_TOKEN'],
                              :user => ENV['PUSHOVER_USER'],
                              :title => "OnePlus",
                              :message => "Error login #{@us.email}"
                            })
          res = Net::HTTP.new(urlp.host, urlp.port)
          res.use_ssl = true
          res.verify_mode = OpenSSL::SSL::VERIFY_PEER
          res.start { |http|
            http.request(req)
          }
          @a.get('https://account.oneplus.net/login') do |login|
            login.form_with(:action => 'https://account.oneplus.net/login') do |f|
              f.email      = @us.email
              f.password   = @us.password
            end.click_button
          end
        end
      else
        @count = @count + 1
      end
    end
  rescue
    puts "Error TWITTER"
  end
end

th1 = Thread.new{getTwitter()}
th2 = Thread.new{getForum()}
th1.join
th2.join
