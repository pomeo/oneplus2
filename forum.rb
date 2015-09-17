#!/usr/bin/env ruby
# -*- coding: utf-8 -*-
require 'rubygems'
require 'bundler/setup'
require 'mechanize'
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

@us = Emailsaccounts.first(:sell => false, :order => [ :start.asc ])
puts @us.email

@user = @us.email
@pass = @us.password

@a = Mechanize.new { |agent|
  agent.user_agent_alias = 'Windows Chrome'
}

@count = 0
begin
  @a.get('https://account.oneplus.net/login') do |app|
    app.form_with(:action => 'https://account.oneplus.net/login') do |f|
      f.email      = @user
      f.password   = @pass
    end.click_button
  end
rescue
 puts "Error FORM #{@user}"
end

if @a.page.title != 'Edit User Information - OnePlus Account'
  urlp = URI.parse('https://api.pushover.net/1/messages.json')
  req = Net::HTTP::Post.new(urlp.path)
  req.set_form_data({
                      :token => ENV['PUSHOVER_TOKEN'],
                      :user => ENV['PUSHOVER_USER'],
                      :title => "OnePlus",
                      :message => "Error login #{@user}"
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
    puts url
    @a.get(url) do |m|
      if (m.uri.to_s.match(/invites.oneplus.net/i))
        if (app.at('p.h3.text-left.text-red').text.strip == 'You entered an invalid invite')
          puts "Used invite"
        else
          @t2 = Time.now
          delta = @t2 - @t1
          puts "Time #{delta}"
          puts m.uri.to_s
          puts m.title
          @a.get('https://invites.oneplus.net/my-invites') do |app|
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
                                  :title => "#{d[0].title} Forum",
                                  :message => "#{@us.email}\n#{left}"
                                })
              res = Net::HTTP.new(urlp.host, urlp.port)
              res.use_ssl = true
              res.verify_mode = OpenSSL::SSL::VERIFY_PEER
              res.start { |http|
                http.request(req)
              }
              @a.get('https://account.oneplus.net/onepluslogout')
              @us = Emailsaccounts.first(:sell => false, :order => [ :start.asc ])
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
    puts "Error"
  end
end

while true
  begin
    xml_data = URI.parse('https://forums.oneplus.net/forums/-/index.rss').read

    data = XmlSimple.xml_in(xml_data)

    data['channel'][0]['item'].each do |item|
      if (item['encoded'][0].match(/([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/))
        m = item['encoded'][0].match(/([A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4}-[A-Z0-9]{4})/)
        t = 'https://invites.oneplus.net/claim/%s' % m
        getinvite(t)
      end
      urls = URI.extract(item['encoded'][0], ['http', 'https'])
      urls.each do |u|
        @t1 = Time.now
        if (u.match(/invites.oneplus.net\/claim/i))
          getinvite(u)
        elsif (u.match(/onepl.us/i))
          getinvite(u)
        elsif (u.match(/mandrillapp.com/i))
          getinvite(u)
        elsif (u.match(/bit.ly/i))
          getinvite(u)
        elsif (u.match(/j.mp/i))
          getinvite(u)
        elsif (u.match(/ow.ly/i))
          getinvite(u)
        elsif (u.match(/goo.gl/i))
          getinvite(u)
        elsif (u.match(/fb.me/i))
          getinvite(u)
        elsif (u.match(/lnkd.in/i))
          getinvite(u)
        end
      end
    end
    if (@count == 3600)
      puts "#{@count} #{@us.email} #{Time.now}"
      @a.get('https://invites.oneplus.net/my-invites')
      puts @a.page.title
      @count = 0
    else
      @count = @count + 1
    end
  rescue
    puts "Error forum"
  end
  sleep 1
end
